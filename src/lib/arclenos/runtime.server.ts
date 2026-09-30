import { getSql } from "@/lib/db";
import { AGENTS, BASE, CAPITAL_POLICIES, COMMERCE_SKUS, PRIMITIVES, archetypeById } from "./catalog";
import { healthBand } from "./economics";
import { factorsFromPool, scoreOpportunity } from "./scoring";
import { reviewComposition, canApprove } from "./security";
import { simulateComposition } from "./simulation";

import { buildX402Requirement } from "./x402";
import type {
  AgentRun,
  Archetype,
  ChainSnapshot,
  Composition,
  ContractCheck,
  HealthComponent,
  HealthReport,
  Opportunity,
  RevenueEvent,
  Venture,
  VentureStatus,
  JsonObject,
  JsonValue,
} from "./types";

const g = globalThis as typeof globalThis & {
  __arcCache?: Record<string, { at: number; value: unknown }>;
};

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = g.__arcCache?.[key];
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) return null;
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  g.__arcCache ??= {};
  g.__arcCache[key] = { at: Date.now(), value };
}

async function fetchJson<T>(url: string, ms = 8000): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return (await res.json()) as T;
}

async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  let last = "all Base RPCs failed";
  for (const url of BASE.rpcs) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(5000),
      });
      const json = (await res.json()) as { result?: unknown; error?: { message?: string } };
      if (json.error) throw new Error(json.error.message ?? "rpc error");
      return json.result;
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

function hasRuntimeCode(code: unknown) {
  return typeof code === "string" && code !== "0x" && code.length > 4;
}

function asObj(v: unknown): JsonObject {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as JsonObject;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) return p as JsonObject;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function asArr<T>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      if (Array.isArray(p)) return p as T[];
    } catch {
      /* ignore */
    }
  }
  return [];
}

export async function getChainSnapshot(): Promise<ChainSnapshot> {
  const cached = cacheGet<ChainSnapshot>("chain", 20_000);
  if (cached) return cached;

  const checks: Array<{ name: string; address: string; source: string }> = [
    { name: "USDC", address: BASE.tokens.usdc.address, source: BASE.tokens.usdc.source },
    { name: "WETH", address: BASE.tokens.weth.address, source: BASE.tokens.weth.source },
    { name: "AERO", address: BASE.tokens.aero.address, source: BASE.tokens.aero.source },
    { name: "Aerodrome Router", address: BASE.aerodrome.router, source: BASE.aerodrome.source },
    { name: "Aerodrome PoolFactory", address: BASE.aerodrome.poolFactory, source: BASE.aerodrome.source },
    { name: "Aerodrome Voter", address: BASE.aerodrome.voter, source: BASE.aerodrome.source },
    { name: "Aave V3 Pool", address: BASE.aaveV3.pool, source: BASE.aaveV3.source },
    { name: "Morpho Blue", address: BASE.morpho.blue, source: BASE.morpho.source },
  ];

  let blockHex = "0x0";
  let rpcUsed = BASE.rpcs[0];
  try {
    const chainId = Number.parseInt(String(await rpc("eth_chainId")), 16);
    if (chainId !== 8453) throw new Error("RPC chain identity mismatch");
    blockHex = (await rpc("eth_blockNumber")) as string;
    rpcUsed = BASE.rpcs[0];
  } catch {
    throw new Error("Base RPC chain identity or latest block unavailable");
  }

  const codes = await Promise.all(
    checks.map(async (c) => {
      try {
        const code = await rpc("eth_getCode", [c.address, "latest"]);
        const ok = hasRuntimeCode(code);
        return {
          name: c.name,
          address: c.address,
          source: c.source,
          hasCode: ok,
          verification: ok ? ("BLOCKED" as const) : ("FAILED" as const),
        } satisfies ContractCheck;
      } catch {
        return {
          name: c.name,
          address: c.address,
          source: c.source,
          hasCode: false,
          verification: "FAILED" as const,
        };
      }
    }),
  );

  let block: { hash?: string; timestamp?: string } | null = null;
  try {
    block = (await rpc("eth_getBlockByNumber", [blockHex, false])) as { hash?: string; timestamp?: string } | null;
  } catch {
    block = null;
  }

  const snap: ChainSnapshot = {
    chainId: BASE.chainId,
    blockNumber: Number.parseInt(blockHex, 16) || 0,
    blockHash: block?.hash ?? null,
    timestamp: block?.timestamp ? Number.parseInt(block.timestamp, 16) : null,
    rpc: rpcUsed,
    contracts: codes,
    fetchedAt: new Date().toISOString(),
  };
  cacheSet("chain", snap);
  return snap;
}

type LlamaPool = {
  chain?: string;
  project?: string;
  symbol?: string;
  tvlUsd?: number;
  apy?: number;
  apyBase?: number;
  apyReward?: number;
  volumeUsd1d?: number;
  pool?: string;
  url?: string;
};

type LlamaProtocol = {
  name?: string;
  slug?: string;
  tvl?: number;
  change_1d?: number;
  chains?: string[];
  chainTvls?: Record<string, number>;
  url?: string;
  category?: string;
  address?: string;
};

function opportunityFromPool(p: LlamaPool): Opportunity | null {
  if (!p.pool || !p.project) return null;
  const tvl = typeof p.tvlUsd === "number" ? p.tvlUsd : null;
  const apy = typeof p.apy === "number" ? p.apy : null;
  const factors = factorsFromPool({
    tvlUsd: tvl,
    apy,
    apyBase: p.apyBase ?? null,
    volumeUsd1d: p.volumeUsd1d ?? null,
    protocol: p.project,
  });
  return {
    id: `pool:${p.pool}`,
    source: "defillama.yields",
    title: `${p.project} ${p.symbol ?? ""}`.trim(),
    protocol: p.project,
    symbol: p.symbol ?? "",
    chainId: BASE.chainId,
    tvlUsd: tvl,
    apy,
    apyBase: p.apyBase ?? null,
    apyReward: p.apyReward ?? null,
    volumeUsd1d: p.volumeUsd1d ?? null,
    score: scoreOpportunity(factors),
    factors,
    poolAddress: p.pool.length === 42 ? p.pool : null,
    url: p.url ?? `https://defillama.com/yields/pool/${p.pool}`,
    updatedAt: new Date().toISOString(),
  };
}

function opportunityFromProtocol(p: LlamaProtocol): Opportunity | null {
  if (!p.slug || !p.name) return null;
  const tvl = p.chainTvls?.Base ?? p.chainTvls?.base ?? (typeof p.tvl === "number" ? p.tvl : null);
  // TVL change is not traded volume. The protocols endpoint does not measure it.
  const vol = null;
  const factors = factorsFromPool({
    tvlUsd: tvl,
    apy: null,
    apyBase: null,
    volumeUsd1d: vol,
    protocol: p.slug,
  });
  return {
    id: `proto:${p.slug}`,
    source: "defillama.protocols",
    title: p.name,
    protocol: p.slug,
    symbol: p.category ?? "",
    chainId: BASE.chainId,
    tvlUsd: tvl,
    apy: null,
    apyBase: null,
    apyReward: null,
    volumeUsd1d: vol,
    score: scoreOpportunity(factors),
    factors,
    poolAddress: p.address && p.address.startsWith("0x") ? p.address : null,
    url: p.url ?? `https://defillama.com/protocol/${p.slug}`,
    updatedAt: new Date().toISOString(),
  };
}

export async function ingestOpportunities(): Promise<{ items: Opportunity[]; source: string; error: string | null }> {
  const cached = cacheGet<{ items: Opportunity[]; source: string; error: string | null }>("opps", 120_000);
  if (cached) return cached;

  let items: Opportunity[] = [];
  let source = "none";
  let error: string | null = null;

  try {
    const body = await fetchJson<{ data?: LlamaPool[] }>("https://yields.llama.fi/pools", 12000);
    const pools = (body.data ?? []).filter((p) => p.chain === "Base");
    const ranked = pools
      .map(opportunityFromPool)
      .filter((x): x is Opportunity => x != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 48);
    if (ranked.length) {
      items = ranked;
      source = "defillama.yields.base";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (!items.length) {
    try {
      const protocols = await fetchJson<LlamaProtocol[]>("https://api.llama.fi/protocols", 10000);
      const base = protocols.filter((p) => (p.chains ?? []).includes("Base"));
      items = base
        .map(opportunityFromProtocol)
        .filter((x): x is Opportunity => x != null)
        .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
        .slice(0, 48);
      source = "defillama.protocols.base";
      if (items.length) error = error ? `${error} · yields fallback to protocols` : null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      error = error ? `${error} · ${msg}` : msg;
    }
  }

  if (items.length) {
    const sql = await getSql();
    for (const o of items) {
      await sql`
        insert into opportunities (
          id, source, title, protocol, symbol, chain_id, tvl_usd, apy, apy_base,
          volume_usd_1d, score, factors, pool_address, url, payload, updated_at
        ) values (
          ${o.id}, ${o.source}, ${o.title}, ${o.protocol}, ${o.symbol}, ${o.chainId},
          ${o.tvlUsd}, ${o.apy}, ${o.apyBase}, ${o.volumeUsd1d}, ${o.score},
          ${JSON.stringify(o.factors)}::jsonb, ${o.poolAddress}, ${o.url},
          ${JSON.stringify({ apyReward: o.apyReward })}::jsonb, ${o.updatedAt}
        )
        on conflict (id) do update set
          source = excluded.source,
          title = excluded.title,
          protocol = excluded.protocol,
          symbol = excluded.symbol,
          tvl_usd = excluded.tvl_usd,
          apy = excluded.apy,
          apy_base = excluded.apy_base,
          volume_usd_1d = excluded.volume_usd_1d,
          score = excluded.score,
          factors = excluded.factors,
          pool_address = excluded.pool_address,
          url = excluded.url,
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `;
    }
    await recordAgent({
      agent: "scout",
      ventureId: null,
      from: null,
      to: "DISCOVERED",
      reason: `Ingested ${items.length} Base opportunities from ${source}.`,
      evidence: { source, count: items.length, error },
    });
  }

  const result = { items, source, error };
  cacheSet("opps", result);
  return result;
}

type OppRow = {
  id: string;
  source: string;
  title: string;
  protocol: string;
  symbol: string;
  chain_id: number;
  tvl_usd: number | null;
  apy: number | null;
  apy_base: number | null;
  volume_usd_1d: number | null;
  score: number;
  factors: unknown;
  pool_address: string | null;
  url: string | null;
  payload: unknown;
  updated_at: string;
};

function rowToOpp(r: OppRow): Opportunity {
  const payload = asObj(r.payload);
  return {
    id: r.id,
    source: r.source,
    title: r.title,
    protocol: r.protocol,
    symbol: r.symbol,
    chainId: Number(r.chain_id),
    tvlUsd: r.tvl_usd,
    apy: r.apy,
    apyBase: r.apy_base,
    apyReward: typeof payload.apyReward === "number" ? payload.apyReward : null,
    volumeUsd1d: r.volume_usd_1d,
    score: r.score,
    factors: asObj(r.factors) as Opportunity["factors"],
    poolAddress: r.pool_address,
    url: r.url,
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : new Date(r.updated_at).toISOString(),
  };
}

export async function listOpportunities(limit = 48): Promise<Opportunity[]> {
  const sql = await getSql();
  const rows = await sql<OppRow>`
    select * from opportunities order by score desc, updated_at desc limit ${limit}
  `;
  if (rows.length) return rows.map(rowToOpp);
  const ingested = await ingestOpportunities();
  return ingested.items.slice(0, limit);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  const sql = await getSql();
  const rows = await sql<OppRow>`select * from opportunities where id = ${id} limit 1`;
  return rows[0] ? rowToOpp(rows[0]) : null;
}

export type DexPair = {
  pairAddress: string;
  dexId: string;
  baseToken: { symbol: string; address: string };
  quoteToken: { symbol: string; address: string };
  priceUsd: string | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  url: string | null;
};

export async function getLiquidityPairs(): Promise<{ pairs: DexPair[]; error: string | null }> {
  const cached = cacheGet<{ pairs: DexPair[]; error: string | null }>("liq", 60_000);
  if (cached) return cached;
  try {
    const body = await fetchJson<{ pairs?: Array<Record<string, unknown>> }>(
      `https://api.dexscreener.com/latest/dex/tokens/${BASE.tokens.weth.address}`,
      8000,
    );
    const pairs = (body.pairs ?? [])
      .filter((p) => String(p.chainId) === "base" || String(p.chainId) === "8453")
      .slice(0, 24)
      .map((p) => {
        const liq = p.liquidity as { usd?: number } | undefined;
        const vol = p.volume as { h24?: number } | undefined;
        const base = p.baseToken as { symbol?: string; address?: string } | undefined;
        const quote = p.quoteToken as { symbol?: string; address?: string } | undefined;
        return {
          pairAddress: String(p.pairAddress ?? ""),
          dexId: String(p.dexId ?? ""),
          baseToken: { symbol: base?.symbol ?? "?", address: base?.address ?? "" },
          quoteToken: { symbol: quote?.symbol ?? "?", address: quote?.address ?? "" },
          priceUsd: typeof p.priceUsd === "string" ? p.priceUsd : null,
          liquidityUsd: typeof liq?.usd === "number" ? liq.usd : null,
          volume24h: typeof vol?.h24 === "number" ? vol.h24 : null,
          url: typeof p.url === "string" ? p.url : null,
        } satisfies DexPair;
      });
    const result = { pairs, error: null };
    cacheSet("liq", result);
    return result;
  } catch (err) {
    return { pairs: [], error: err instanceof Error ? err.message : String(err) };
  }
}

async function recordAgent(run: {
  agent: AgentRun["agent"];
  ventureId: string | null;
  from: VentureStatus | null;
  to: VentureStatus | null;
  reason: string;
  evidence: Record<string, unknown>;
}) {
  const sql = await getSql();
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await sql`
    insert into agent_runs (id, agent, venture_id, state_from, state_to, reason, evidence, created_at)
    values (
      ${id}, ${run.agent}, ${run.ventureId}, ${run.from}, ${run.to}, ${run.reason},
      ${JSON.stringify(run.evidence)}::jsonb, ${createdAt}
    )
  `;
  return { id, createdAt };
}

export async function listAgentRuns(limit = 40): Promise<AgentRun[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    agent: AgentRun["agent"];
    venture_id: string | null;
    state_from: VentureStatus | null;
    state_to: VentureStatus | null;
    reason: string;
    evidence: unknown;
    created_at: string;
  }>`select * from agent_runs order by created_at desc limit ${limit}`;
  return rows.map((r) => ({
    id: r.id,
    agent: r.agent,
    ventureId: r.venture_id,
    from: r.state_from,
    to: r.state_to,
    reason: r.reason,
    evidence: asObj(r.evidence),
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
  }));
}

type VentureRow = {
  id: string;
  name: string;
  archetype: Archetype;
  status: VentureStatus;
  opportunity_id: string | null;
  config: unknown;
  composition: unknown;
  simulation: unknown;
  security: unknown;
  lineage: unknown;
  risk_status: string;
  created_at: string;
  updated_at: string;
};

function rowToVenture(r: VentureRow): Venture {
  return {
    id: r.id,
    name: r.name,
    archetype: r.archetype,
    status: r.status,
    opportunityId: r.opportunity_id,
    config: asObj(r.config),
    composition: (r.composition ? asObj(r.composition) : null) as Composition | null,
    simulation: r.simulation ? asArr(r.simulation) : null,
    security: r.security ? asArr(r.security) : null,
    lineage: asObj(r.lineage) as Venture["lineage"],
    riskStatus: r.risk_status,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
    updatedAt: typeof r.updated_at === "string" ? r.updated_at : new Date(r.updated_at).toISOString(),
  };
}

export async function listVentures(): Promise<Venture[]> {
  const sql = await getSql();
  const rows = await sql<VentureRow>`select * from ventures order by updated_at desc limit 80`;
  return rows.map(rowToVenture);
}

export async function getVenture(id: string): Promise<Venture | null> {
  const sql = await getSql();
  const rows = await sql<VentureRow>`select * from ventures where id = ${id} limit 1`;
  return rows[0] ? rowToVenture(rows[0]) : null;
}

export async function composeVenture(input: {
  opportunityId: string | null;
  opportunityTitle: string | null;
  archetype: Archetype;
  name: string;
  composition: Composition;
  createdBy: "agent" | "operator";
}): Promise<{ venture: Venture; blocked: string | null }> {
  const arch = archetypeById(input.archetype);
  if (!arch) throw new Error("Unknown archetype.");
  const composition: Composition = {
    ...input.composition,
    archetype: input.archetype,
    primitives: input.composition.primitives.length ? input.composition.primitives : arch.primitives,
  };
  const simulation = simulateComposition(composition);
  const security = reviewComposition(composition);
  const approved = canApprove(security);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const name = input.name.trim() || `${arch.name} ${id.slice(0, 4).toUpperCase()}`;
  const versions: Record<string, string> = {};
  for (const pid of composition.primitives) {
    const p = PRIMITIVES.find((x) => x.id === pid);
    if (p) versions[p.id] = p.version;
  }
  const lineage = {
    parentId: input.opportunityId,
    primitiveVersions: versions,
    createdBy: input.createdBy,
  };
  const status: VentureStatus = approved ? "SECURITY_REVIEWED" : "REJECTED";
  const blocked = approved
    ? "Offchain review complete. Deployment requires approved template, verified factory manifest, authorized transaction and receipt/bytecode/initialization checks."
    : "Open P0 findings. Venture rejected until invariants hold.";

  const sql = await getSql();
  await sql`
    insert into ventures (
      id, name, archetype, status, opportunity_id, config, composition, simulation, security, lineage, risk_status, created_at, updated_at
    ) values (
      ${id}, ${name}, ${input.archetype}, ${status}, ${input.opportunityId},
      ${JSON.stringify({ opportunityTitle: input.opportunityTitle, caps: composition.caps })}::jsonb,
      ${JSON.stringify(composition)}::jsonb,
      ${JSON.stringify(simulation)}::jsonb,
      ${JSON.stringify(security)}::jsonb,
      ${JSON.stringify(lineage)}::jsonb,
      ${approved ? "deployment_unverified" : "rejected"},
      ${now}, ${now}
    )
  `;

  await recordAgent({
    agent: "simulator", ventureId: id, from: "COMPOSED", to: "SIMULATED",
    reason: "Deterministic five-scenario simulation executed.", evidence: { simulation },
  });
  await recordAgent({
    agent: "sentinel", ventureId: id, from: "SIMULATED", to: status,
    reason: "Static composition review executed. This is not a deployed contract audit.", evidence: { security, approved },
  });

  await sql`
    insert into lineage_events (id, venture_id, kind, payload, created_at)
    values (
      ${crypto.randomUUID()}, ${id}, ${approved ? "offchain_reviewed" : "rejected"},
      ${JSON.stringify({ composition, blocked, chainId: BASE.chainId })}::jsonb,
      ${now}
    )
  `;

  const venture = await getVenture(id);
  if (!venture) throw new Error("Venture persist failed.");
  return { venture, blocked };
}

export async function getHealth(): Promise<HealthReport> {
  const started = Date.now();
  const components: HealthComponent[] = [];
  let chain: ChainSnapshot | null = null;
  try {
    chain = await getChainSnapshot();
    const verified = chain.contracts.filter((c) => c.hasCode).length;
    const score = Math.round((verified / Math.max(chain.contracts.length, 1)) * 100);
    components.push({
      id: "chain",
      label: "Base RPC + bytecode",
      score,
      band: healthBand(score),
      detail: `block ${chain.blockNumber} · ${verified}/${chain.contracts.length} code present; source/identity verification separate`,
    });
  } catch (err) {
    components.push({
      id: "chain",
      label: "Base RPC + bytecode",
      score: 20,
      band: "CONTAIN",
      detail: err instanceof Error ? err.message : "rpc failed",
    });
  }

  try {
    const sql = await getSql();
    const ping = await sql<{ n: number }>`select 1::int as n`;
    components.push({
      id: "db",
      label: "Database",
      score: ping[0]?.n === 1 ? 96 : 40,
      band: ping[0]?.n === 1 ? "HEALTHY" : "RESTRICTED",
      detail: ping[0]?.n === 1 ? "query ok" : "unexpected ping",
    });
  } catch (err) {
    components.push({
      id: "db",
      label: "Database",
      score: 15,
      band: "CONTAIN",
      detail: err instanceof Error ? err.message : "db failed",
    });
  }

  try {
    const intel = await ingestOpportunities();
    const score = intel.items.length ? 90 : 55;
    components.push({
      id: "intel",
      label: "Intelligence ingest",
      score,
      band: healthBand(score),
      detail: intel.error ? intel.error : `${intel.items.length} from ${intel.source}`,
    });
  } catch (err) {
    components.push({
      id: "intel",
      label: "Intelligence ingest",
      score: 45,
      band: "RESTRICTED",
      detail: err instanceof Error ? err.message : "intel failed",
    });
  }

  const runs = await listAgentRuns(1);
  const lastRun = runs[0];
  const agentScore = lastRun ? 60 : 35;
  components.push({
    id: "agents",
    label: "Agent event ledger",
    score: agentScore,
    band: healthBand(agentScore),
    detail: lastRun ? `Last recorded event: ${lastRun.agent} · ${lastRun.to ?? "idle"}; execution requires separate worker evidence.` : "No agent events.",
  });

  const commerceConfigured = Boolean(
    process.env.DATABASE_URL && process.env.ARCLENOS_TREASURY_ADDRESS &&
    process.env.X402_FACILITATOR_URL && process.env.BASE_RPC_URL &&
    process.env.ARCLENOS_PUBLIC_ORIGIN && process.env.ARCLENOS_INTERNAL_PAYER_ADDRESSES
  );
  try {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`select count(*)::integer as n from revenue_events where classification = 'x402' and confirmation_status = 'SETTLED' and economic_valid = true`;
    const settled = rows[0]?.n ?? 0;
    components.push({
      id: 'payments', label: 'x402 settlement',
      score: settled > 0 ? 93 : commerceConfigured ? 55 : 20,
      band: settled > 0 ? 'HEALTHY' : 'RESTRICTED',
      detail: settled > 0 ? String(settled) + ' recorded economically valid customer settlements; inspect receipts for transaction evidence.' : commerceConfigured ? 'Configured but no settled customer payment verified.' : 'Payment infrastructure not commissioned.',
    });
  } catch {
    components.push({ id: 'payments', label: 'x402 settlement', score: 20, band: 'RESTRICTED', detail: 'Settlement evidence unavailable.' });
  }

  try {
    const { getFactoryHealth } = await import('./deployment/chain');
    const factory = await getFactoryHealth(await getSql());
    components.push({
      id: 'factory', label: 'Factory on-chain',
      score: factory.verified && factory.operational ? 93 : factory.verified ? 58 : 20,
      band: factory.verified && factory.operational ? 'HEALTHY' : 'RESTRICTED',
      detail: factory.verified ? (factory.operational ? 'Configured bytecode hash verified; emergency pause clear.' : 'Verified factory is paused.') : (factory.reason ?? 'Factory not independently verified.'),
    });
  } catch {
    components.push({ id: 'factory', label: 'Factory on-chain', score: 20, band: 'RESTRICTED', detail: 'Factory deployment evidence unavailable.' });
  }
  const latency = Date.now() - started;
  components.push({
    id: "api",
    label: "Control plane",
    score: latency < 2500 ? 93 : latency < 6000 ? 78 : 60,
    band: healthBand(latency < 2500 ? 93 : latency < 6000 ? 78 : 60),
    detail: `health assembled in ${latency}ms`,
  });

  const overall = Math.round(components.reduce((a, c) => a + c.score, 0) / components.length);
  const report: HealthReport = {
    overall,
    band: components.some(c => c.band === "CONTAIN") ? "CONTAIN" : components.some(c => c.band === "RESTRICTED") ? "RESTRICTED" : healthBand(overall),
    components,
    generatedAt: new Date().toISOString(),
    chainId: chain?.chainId ?? null,
    blockNumber: chain?.blockNumber ?? null,
  };

  try {
    const sql = await getSql();
    await sql`
      insert into health_snapshots (id, overall, components, chain_id, block_number, created_at)
      values (
        ${crypto.randomUUID()}, ${report.overall}, ${JSON.stringify(report.components)}::jsonb,
        ${report.chainId}, ${report.blockNumber}, ${report.generatedAt}
      )
    `;
  } catch {
    /* non-fatal */
  }
  return report;
}

export async function runHealing(): Promise<{ actions: string[]; report: HealthReport }> {
  const report = await getHealth();
  const actions: string[] = [];
  for (const c of report.components) {
    if (c.id === "chain" && c.score < 75) {
      const { rpcHealth, configuredRpcEndpoints } = await import("./operations/adapters");
      const result = await rpcHealth(await getSql(), AbortSignal.timeout(15000), configuredRpcEndpoints(process.env));
      actions.push(`RPC health action: ${JSON.stringify(result)}`);
    }
    if (c.id === "intel" && c.score < 75) {
      cacheSet("opps", undefined);
      const refreshed = await ingestOpportunities();
      actions.push(refreshed.error ? "Cache invalidated; ingestion remains degraded." : `Cache invalidated; verified ${refreshed.items.length} ingested observations.`);
    }
    if (c.id === "factory" && c.score < 70) {
      actions.push("Factory requires deployment verification; no onchain pause transaction was performed.");
    }
  }
  if (!actions.length) actions.push("No bounded repair required. System inside policy.");
  await recordAgent({
    agent: "healing",
    ventureId: null,
    from: null,
    to: null,
    reason: actions.join(" "),
    evidence: { overall: report.overall, actions },
  });
  return { actions, report: await getHealth() };
}

export async function runDailyAudit(): Promise<{ id: string; score: number; findings: Array<{ severity: string; title: string; detail: string }> }> {
  const health = await getHealth();
  const ventures = await listVentures();
  const findings: Array<{ severity: string; title: string; detail: string }> = [];
  if (health.overall < 75) findings.push({ severity: "P1", title: "Control plane degraded", detail: health.band });
  const rejected = ventures.filter((v) => v.status === "REJECTED").length;
  if (rejected) findings.push({ severity: "info", title: "Rejected compositions", detail: `${rejected} held at sentinel.` });
  findings.push({
    severity: "info",
    title: "Mainnet factory",
    detail: health.components.find(c => c.id === "factory")?.detail ?? "Factory deployment unverified.",
  });
  const id = crypto.randomUUID();
  const sql = await getSql();
  await sql`
    insert into audits (id, scope, score, findings, created_at)
    values (${id}, ${"daily"}, ${health.overall}, ${JSON.stringify(findings)}::jsonb, ${new Date().toISOString()})
  `;
  await recordAgent({
    agent: "auditor",
    ventureId: null,
    from: null,
    to: null,
    reason: `Daily audit score ${health.overall}.`,
    evidence: { findings },
  });
  return { id, score: health.overall, findings };
}

export async function listAudits() {
  const sql = await getSql();
  return sql<{ id: string; scope: string; score: number | null; findings: JsonValue; created_at: string }>`
    select * from audits order by created_at desc limit 12
  `;
}

export async function listRevenue(): Promise<RevenueEvent[]> {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    product: RevenueEvent["product"];
    amount_usd: number;
    asset: string;
    tx_id: string | null;
    classification: RevenueEvent["classification"];
    attribution: string | null;
    created_at: string;
  }>`select * from revenue_events where economic_valid=true and confirmation_status='SETTLED' order by created_at desc limit 40`;
  return rows.map((r) => ({
    id: r.id,
    product: r.product,
    amountUsd: r.amount_usd,
    asset: r.asset,
    txId: r.tx_id,
    classification: r.classification,
    attribution: r.attribution,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date(r.created_at).toISOString(),
  }));
}

export async function recordFunnel(name: string, path: string, meta: Record<string, unknown> = {}) {
  const sql = await getSql();
  await sql`
    insert into funnel_events (id, name, path, meta, created_at)
    values (${crypto.randomUUID()}, ${name}, ${path}, ${JSON.stringify(meta)}::jsonb, ${new Date().toISOString()})
  `;
}

export async function funnelCounts() {
  const sql = await getSql();
  const rows = await sql<{ name: string; n: number }>`
    select name, count(*)::int as n from funnel_events group by name
  `;
  const map: Record<string, number> = {};
  for (const r of rows) map[r.name] = Number(r.n);
  return map;
}

export async function clickReferral(code: string) {
  const sql = await getSql();
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { code: "", clicks: 0 };
  await sql`
    insert into referrals (code, clicks, conversions, quality, created_at)
    values (${normalized}, 1, 0, null, ${new Date().toISOString()})
    on conflict (code) do update set clicks = referrals.clicks + 1
  `;
  const rows = await sql<{ code: string; clicks: number; conversions: number; quality: number | null }>`
    select code, clicks, conversions, quality from referrals where code = ${normalized}
  `;
  return rows[0] ?? { code: normalized, clicks: 1, conversions: 0, quality: null };
}

export async function listReferrals() {
  const sql = await getSql();
  return sql<{ code: string; clicks: number; conversions: number; quality: number | null; created_at: string }>`
    select * from referrals order by clicks desc limit 40
  `;
}

export function commerceCatalog() {
  return COMMERCE_SKUS.map((s) => ({ ...s, asset: BASE.tokens.usdc, network: "base" as const }));
}

export function x402Quote(skuId: string, origin: string) {
  const payTo = process.env.ARCLENOS_TREASURY_ADDRESS ?? null;
  return buildX402Requirement({ skuId, payTo, resourceOrigin: process.env.ARCLENOS_PUBLIC_ORIGIN ?? origin });
}

export function x402SettleAttempt(skuId: string, _paymentHeader: string | null, origin: string) {
  const quote = x402Quote(skuId, origin);
  return {
    status: "BLOCKED" as const,
    reason: "Use the SKU HTTP endpoint with a validated request body and PAYMENT-SIGNATURE. The legacy server function cannot settle payments.",
    quote,
  };
}

export async function aiBrief(opportunityId: string): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "AI is not available in this environment." };
  const opp = await getOpportunity(opportunityId);
  if (!opp) return { ok: false, error: "Unknown opportunity." };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are the ARCLENØS opportunity engine. Use only the supplied observed numbers. Never invent TVL, APY, volume, addresses, or partners. Recommend an archetype from: yield-vault, launch-controller, x402-commerce, liquidity-router, market-instrument, attribution-network. Be concise and institutional.",
        },
        {
          role: "user",
          content: JSON.stringify({
            title: opp.title,
            protocol: opp.protocol,
            tvlUsd: opp.tvlUsd,
            apy: opp.apy,
            volumeUsd1d: opp.volumeUsd1d,
            score: opp.score,
            factors: opp.factors,
            source: opp.source,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return { ok: false, error: `xAI API error ${res.status}` };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  const sql = await getSql();
  await sql`
    insert into briefs (id, body, model, created_at)
    values (${crypto.randomUUID()}, ${text}, ${"grok-4.5"}, ${new Date().toISOString()})
  `;
  return { ok: true, text, model: "grok-4.5" };
}

export function capitalSnapshot() {
  const treasury = process.env.ARCLENOS_TREASURY ?? null;
  return {
    treasury,
    verification: treasury ? ("BLOCKED" as const) : ("NOT_APPLICABLE" as const),
    note: treasury
      ? "Address present. Live balances require a signed eth_call from the operator wallet — not displayed as fabricated."
      : "Treasury address not authorized. Balances are NOT APPLICABLE, not zero.",
    policies: CAPITAL_POLICIES,
    agents: AGENTS,
  };
}

export async function operationsBundle() {
  const [health, chain, ventures, runs, audits, revenue, referrals, funnel, opps] = await Promise.all([
    getHealth(),
    getChainSnapshot().catch(() => null),
    listVentures(),
    listAgentRuns(30),
    listAudits(),
    listRevenue(),
    listReferrals(),
    funnelCounts(),
    listOpportunities(8),
  ]);
  return { health, chain, ventures, runs, audits, revenue, referrals, funnel, opps, capital: capitalSnapshot() };
}

export async function homeBundle() {
  const [health, chain, intel, ventures] = await Promise.all([
    getHealth(),
    getChainSnapshot().catch(() => null),
    ingestOpportunities(),
    listVentures(),
  ]);
  return {
    health,
    chain,
    opportunities: intel.items.slice(0, 8),
    intelSource: intel.source,
    intelError: intel.error,
    ventures: ventures.slice(0, 6),
  };
}
