import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Archetype, Composition } from "./types";
import { ARCHETYPES } from "./catalog";

const compositionSchema = z.object({
  archetype: z.enum([
    "yield-vault",
    "launch-controller",
    "x402-commerce",
    "liquidity-router",
    "market-instrument",
    "attribution-network",
  ]),
  primitives: z.array(z.string()),
  feeBps: z.object({
    protocol: z.number(),
    creator: z.number(),
    referrer: z.number(),
    builder: z.number(),
    treasury: z.number(),
  }),
  caps: z.object({
    maxTvlUsd: z.number(),
    maxDepositUsd: z.number(),
    maxDailyOutflowUsd: z.number(),
  }),
  pauseGuards: z.boolean(),
  circuitBreaker: z.boolean(),
});

export const loadHome = createServerFn({ method: "GET" }).handler(async () => {
  const { homeBundle } = await import("./runtime.server");
  return homeBundle();
});

export const loadIntelligence = createServerFn({ method: "GET" }).handler(async () => {
  const { ingestOpportunities, getChainSnapshot } = await import("./runtime.server");
  const [intel, chain] = await Promise.all([ingestOpportunities(), getChainSnapshot().catch(() => null)]);
  return { ...intel, chain };
});

export const refreshIntelligence = createServerFn({ method: "POST" }).handler(async () => {
  const { ingestOpportunities } = await import("./runtime.server");
  const g = globalThis as typeof globalThis & { __arcCache?: Record<string, unknown> };
  if (g.__arcCache) delete g.__arcCache.opps;
  return ingestOpportunities();
});

export const loadYield = createServerFn({ method: "GET" }).handler(async () => {
  const { listOpportunities, getChainSnapshot } = await import("./runtime.server");
  const items = await listOpportunities(48);
  const yieldLike = items.filter((o) => o.apy != null && (o.apy ?? 0) > 0);
  return { items: yieldLike.slice(0, 24), chain: await getChainSnapshot().catch(() => null) };
});

export const loadLiquidity = createServerFn({ method: "GET" }).handler(async () => {
  const { getLiquidityPairs, getChainSnapshot } = await import("./runtime.server");
  const [liq, chain] = await Promise.all([getLiquidityPairs(), getChainSnapshot().catch(() => null)]);
  return { ...liq, chain };
});

export const loadAtlas = createServerFn({ method: "GET" }).handler(async () => {
  const { listVentures, listAgentRuns, getChainSnapshot } = await import("./runtime.server");
  const [ventures, runs, chain] = await Promise.all([
    listVentures(),
    listAgentRuns(50),
    getChainSnapshot().catch(() => null),
  ]);
  return { ventures, runs, chain };
});

export const loadVenture = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const { getVenture, listAgentRuns } = await import("./runtime.server");
    const venture = await getVenture(data.id);
    const runs = (await listAgentRuns(80)).filter((r) => r.ventureId === data.id);
    return { venture, runs };
  });

export const loadOperations = createServerFn({ method: "GET" }).handler(async () => {
  const { operationsBundle } = await import("./runtime.server");
  return operationsBundle();
});

export const loadCapital = createServerFn({ method: "GET" }).handler(async () => {
  const { capitalSnapshot, getHealth, listRevenue } = await import("./runtime.server");
  const [health, revenue] = await Promise.all([getHealth(), listRevenue()]);
  return { ...capitalSnapshot(), health, revenue };
});

export const loadNetwork = createServerFn({ method: "GET" }).handler(async () => {
  const { listReferrals, funnelCounts } = await import("./runtime.server");
  return { referrals: await listReferrals(), funnel: await funnelCounts() };
});

export const loadCommerce = createServerFn({ method: "GET" }).handler(async () => {
  const { commerceCatalog, x402Quote, listRevenue } = await import("./runtime.server");
  const origin = "https://arclenos.com";
  return {
    skus: commerceCatalog(),
    quotes: commerceCatalog().map((s) => ({ id: s.id, ...x402Quote(s.id, origin) })),
    revenue: await listRevenue(),
    treasurySet: Boolean(process.env.ARCLENOS_TREASURY),
  };
});

export const quoteSku = createServerFn({ method: "POST" })
  .validator(z.object({ skuId: z.string() }))
  .handler(async ({ data }) => {
    const { x402Quote } = await import("./runtime.server");
    return x402Quote(data.skuId, "https://arclenos.com");
  });

export const attemptSku = createServerFn({ method: "POST" })
  .validator(z.object({ skuId: z.string(), payment: z.string().nullable() }))
  .handler(async ({ data }) => {
    const { x402SettleAttempt } = await import("./runtime.server");
    return x402SettleAttempt(data.skuId, data.payment, "https://arclenos.com");
  });

export const runCompose = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().nullable(),
      opportunityTitle: z.string().nullable(),
      archetype: z.custom<Archetype>(),
      name: z.string(),
      composition: compositionSchema,
      createdBy: z.enum(["agent", "operator"]),
    }),
  )
  .handler(async ({ data }) => {
    const { composeVenture } = await import("./runtime.server");
    return composeVenture({
      ...data,
      composition: data.composition as Composition,
    });
  });

export const runHeal = createServerFn({ method: "POST" }).handler(async () => {
  const { runHealing } = await import("./runtime.server");
  return runHealing();
});

export const runAudit = createServerFn({ method: "POST" }).handler(async () => {
  const { runDailyAudit } = await import("./runtime.server");
  return runDailyAudit();
});

export const trackFunnel = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string(), path: z.string(), meta: z.record(z.string(), z.unknown()).optional() }))
  .handler(async ({ data }) => {
    const { recordFunnel } = await import("./runtime.server");
    await recordFunnel(data.name, data.path, data.meta ?? {});
    return { ok: true as const };
  });

export const trackReferral = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string() }))
  .handler(async ({ data }) => {
    const { clickReferral } = await import("./runtime.server");
    return clickReferral(data.code);
  });

export const requestBrief = createServerFn({ method: "POST" })
  .validator(z.object({ opportunityId: z.string() }))
  .handler(async ({ data }) => {
    const { aiBrief } = await import("./runtime.server");
    return aiBrief(data.opportunityId);
  });

export const simulateNow = createServerFn({ method: "POST" })
  .validator(z.object({ composition: compositionSchema }))
  .handler(async ({ data }) => {
    const { simulateComposition } = await import("./simulation");
    const { reviewComposition, canApprove } = await import("./security");
    const composition = data.composition as Composition;
    return {
      simulation: simulateComposition(composition),
      security: reviewComposition(composition),
      canApprove: canApprove(reviewComposition(composition)),
    };
  });

export const archetypes = ARCHETYPES;
