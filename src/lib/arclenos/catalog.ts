import type { AgentId, Archetype, CapitalPolicy, Primitive, ProductFamily } from "./types";

/** Verified Base mainnet addresses. Sources recorded; runtime bytecode is checked via RPC. */
export const BASE = {
  chainId: 8453,
  name: "Base",
  explorer: "https://basescan.org",
  rpcs: [
    "https://mainnet.base.org",
    "https://base.llamarpc.com",
    "https://base.publicnode.com",
  ],
  tokens: {
    usdc: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
      symbol: "USDC",
      source: "Circle official USDC contract addresses",
    },
    weth: {
      address: "0x4200000000000000000000000000000000000006",
      decimals: 18,
      symbol: "WETH",
      source: "Base official predeploys",
    },
    aero: {
      address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631",
      decimals: 18,
      symbol: "AERO",
      source: "Aerodrome Finance contracts README",
    },
  },
  aerodrome: {
    router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
    poolFactory: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    voter: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
    votingEscrow: "0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4",
    slipstreamFactory: "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    slipstreamRouter: "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5",
    source: "https://github.com/aerodrome-finance/contracts/blob/main/README.md",
  },
  aaveV3: {
    pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
    source: "Aave V3 deployments (Base)",
  },
  morpho: {
    blue: "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
    source: "Morpho Blue singleton (canonical across supported chains)",
  },
} as const;

export const PRODUCTS: Array<{
  id: ProductFamily;
  name: string;
  kicker: string;
  lede: string;
  href: string;
}> = [
  {
    id: "factory",
    name: "Factory",
    kicker: "Compose",
    lede: "Select, parameterize and deploy from the hardened primitive library.",
    href: "/factory",
  },
  {
    id: "intelligence",
    name: "Intelligence",
    kicker: "Discover",
    lede: "Score live Base demand. Never invent unavailable telemetry.",
    href: "/intelligence",
  },
  {
    id: "yield",
    name: "Yield",
    kicker: "Allocate",
    lede: "Vault primitives, adapters and bounded capital with observed rates only.",
    href: "/yield",
  },
  {
    id: "markets",
    name: "Markets",
    kicker: "Structure",
    lede: "Deterministic payoff modules with explicit oracle and unwind paths.",
    href: "/markets",
  },
  {
    id: "launch",
    name: "Launch",
    kicker: "Form capital",
    lede: "Adaptive graduation. No fixed 42 ETH doctrine.",
    href: "/launch",
  },
  {
    id: "commerce",
    name: "Commerce",
    kicker: "Transact",
    lede: "Paid APIs with exact Base USDC requirements, settlement evidence and receipts.",
    href: "/commerce",
  },
  {
    id: "liquidity",
    name: "Liquidity",
    kicker: "Route",
    lede: "Verified Aerodrome and Base venues. Addresses checked against live bytecode.",
    href: "/liquidity",
  },
  {
    id: "network",
    name: "Network",
    kicker: "Distribute",
    lede: "Programmable attribution. Quality-weighted, sybil-aware.",
    href: "/network",
  },
  {
    id: "atlas",
    name: "Atlas",
    kicker: "Prove",
    lede: "Public lineage, performance, risk and provenance.",
    href: "/atlas",
  },
  {
    id: "api",
    name: "API",
    kicker: "Integrate",
    lede: "Machine-readable pricing, idempotency, receipts.",
    href: "/developers",
  },
  {
    id: "capital",
    name: "Capital",
    kicker: "Govern",
    lede: "Policy-gated treasury controls with ALLOW / DENY / CAP / PAUSE.",
    href: "/capital",
  },
  {
    id: "guardstate",
    name: "GuardState",
    kicker: "Control plane",
    lede: "Separate institutional finance control product. Not the factory.",
    href: "/guardstate",
  },
];

export const PRIMITIVES: Primitive[] = [
  {
    id: "factory",
    name: "ArclenosFactory",
    version: "1.0.0",
    category: "core",
    summary: "Implementation registry, clone+init, provenance, emergency containment.",
    invariants: [
      "implementation must contain runtime code",
      "initialize only through factory-controlled path",
      "initializer cannot be stolen or replayed",
      "canonical Deployment event + lineage row",
    ],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "x402-commerce",
      "liquidity-router",
      "market-instrument",
      "attribution-network",
    ],
  },
  {
    id: "registry",
    name: "ImplementationRegistry",
    version: "1.0.0",
    category: "core",
    summary: "Versioned implementations and templates with codehash binding.",
    invariants: ["zero-code addresses rejected", "salt collisions revert"],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "x402-commerce",
      "liquidity-router",
      "market-instrument",
      "attribution-network",
    ],
  },
  {
    id: "vault",
    name: "ArclenosVault4626",
    version: "1.0.0",
    category: "yield",
    summary: "ERC-4626 vault with virtual offset against share inflation.",
    invariants: [
      "assets/shares round in favor of the vault",
      "donation attack cannot steal subsequent depositors",
      "withdraw fails closed on adapter error",
    ],
    requiredBy: ["yield-vault"],
  },
  {
    id: "fee-router",
    name: "FeeRouter",
    version: "1.0.0",
    category: "economics",
    summary: "Configurable bps split. No universal 5% doctrine.",
    invariants: ["splits sum to 10_000 bps", "zero-address recipients rejected"],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "x402-commerce",
      "market-instrument",
      "attribution-network",
    ],
  },
  {
    id: "revenue-splitter",
    name: "RevenueSplitter",
    version: "1.0.0",
    category: "economics",
    summary: "Pull-payment splitter with attribution tags.",
    invariants: ["no push to untrusted receivers in the same tx as accounting"],
    requiredBy: ["x402-commerce", "attribution-network", "launch-controller"],
  },
  {
    id: "referral-router",
    name: "ReferralRouter",
    version: "1.0.0",
    category: "network",
    summary: "Quality-weighted referral graph. Self-referral and cycles denied.",
    invariants: ["no self-referral", "cycles rejected", "duplicate identities collapse"],
    requiredBy: ["launch-controller", "attribution-network"],
  },
  {
    id: "treasury",
    name: "Treasury",
    version: "1.0.0",
    category: "capital",
    summary: "Policy-gated balances: available, committed, obligated.",
    invariants: ["agents cannot exceed caps", "emergency pause halts outflows"],
    requiredBy: ["yield-vault", "launch-controller", "liquidity-router"],
  },
  {
    id: "access-policy",
    name: "AccessPolicy",
    version: "1.0.0",
    category: "security",
    summary: "Role and method allowlists for operator and service wallets.",
    invariants: ["default deny", "least privilege"],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "x402-commerce",
      "liquidity-router",
      "market-instrument",
      "attribution-network",
    ],
  },
  {
    id: "circuit-breaker",
    name: "CircuitBreaker",
    version: "1.0.0",
    category: "security",
    summary: "Trip on invariant failure, oracle deviation, or drawdown.",
    invariants: ["trip is sticky until guardian reset", "cannot be bypassed by pause flag inversion"],
    requiredBy: ["yield-vault", "market-instrument", "liquidity-router"],
  },
  {
    id: "emergency-pause",
    name: "EmergencyPause",
    version: "1.0.0",
    category: "security",
    summary: "Global and per-module pause with documented unpause path.",
    invariants: ["deposits halt on pause", "withdrawals remain available unless insolvency trip"],
    requiredBy: ["yield-vault", "launch-controller", "market-instrument"],
  },
  {
    id: "strategy-registry",
    name: "StrategyRegistry",
    version: "1.0.0",
    category: "yield",
    summary: "Allowlisted adapters with health and cap metadata.",
    invariants: ["unregistered adapters cannot receive capital"],
    requiredBy: ["yield-vault"],
  },
  {
    id: "strategy-adapter",
    name: "StrategyAdapter",
    version: "1.0.0",
    category: "yield",
    summary: "Normalized deposit/withdraw/harvest interface over Base venues.",
    invariants: ["preview == execute within rounding", "harvest cannot mint extra shares"],
    requiredBy: ["yield-vault"],
  },
  {
    id: "oracle-adapter",
    name: "OracleAdapter",
    version: "1.0.0",
    category: "markets",
    summary: "Staleness, deviation and fallback checks before any payoff.",
    invariants: ["stale quotes revert", "zero price reverts"],
    requiredBy: ["market-instrument", "yield-vault"],
  },
  {
    id: "swap-adapter",
    name: "SwapAdapter",
    version: "1.0.0",
    category: "liquidity",
    summary: "Quote then swap with slippage and deadline protection.",
    invariants: ["minOut enforced", "no partial fill without accounting"],
    requiredBy: ["liquidity-router", "yield-vault"],
  },
  {
    id: "liquidity-manager",
    name: "LiquidityManager",
    version: "1.0.0",
    category: "liquidity",
    summary: "Provision, migrate and emergency-exit LP positions.",
    invariants: ["emergency exit prefers worst-case quoted minOut"],
    requiredBy: ["liquidity-router", "launch-controller"],
  },
  {
    id: "aerodrome-adapter",
    name: "AerodromeAdapter",
    version: "1.0.0",
    category: "liquidity",
    summary: "Verified Aerodrome router/factory bindings on Base.",
    invariants: ["target codehash must match last verified snapshot"],
    requiredBy: ["liquidity-router", "yield-vault"],
  },
  {
    id: "x402-adapter",
    name: "X402PaymentAdapter",
    version: "1.0.0",
    category: "commerce",
    summary: "Requirement → payment → verify → settle → receipt. No fake settlement.",
    invariants: ["unverified payment never unlocks service", "replay rejected via idempotency key"],
    requiredBy: ["x402-commerce"],
  },
  {
    id: "attribution-registry",
    name: "AttributionRegistry",
    version: "1.0.0",
    category: "network",
    summary: "Deterministic graph of creator, agent, builder, referrer, LP.",
    invariants: ["edges are append-only", "weights normalized to 1e18"],
    requiredBy: ["attribution-network", "launch-controller", "x402-commerce"],
  },
  {
    id: "lineage-registry",
    name: "LineageRegistry",
    version: "1.0.0",
    category: "atlas",
    summary: "Immutable provenance for every composition and deployment.",
    invariants: ["lineage cannot be rewritten, only appended"],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "x402-commerce",
      "liquidity-router",
      "market-instrument",
      "attribution-network",
    ],
  },
  {
    id: "performance-registry",
    name: "PerformanceRegistry",
    version: "1.0.0",
    category: "atlas",
    summary: "Observed performance, not advertised yield.",
    invariants: ["no yield figure without observation or deterministic derivation"],
    requiredBy: ["yield-vault", "market-instrument"],
  },
  {
    id: "agent-wallet-policy",
    name: "WalletPolicy",
    version: "1.0.0",
    category: "security",
    summary: "Per-tx, per-session, daily caps and destination allowlists.",
    invariants: ["missing allowlist entry is deny", "caps are inclusive of fees"],
    requiredBy: [
      "yield-vault",
      "launch-controller",
      "liquidity-router",
      "x402-commerce",
    ],
  },
];

export const ARCHETYPES: Array<{
  id: Archetype;
  name: string;
  summary: string;
  primitives: string[];
  defaultFees: CompositionFees;
}> = [
  {
    id: "yield-vault",
    name: "Yield vault",
    summary: "ERC-4626 vault over allowlisted Base adapters with circuit breakers.",
    primitives: [
      "factory",
      "registry",
      "vault",
      "fee-router",
      "treasury",
      "access-policy",
      "circuit-breaker",
      "emergency-pause",
      "strategy-registry",
      "strategy-adapter",
      "oracle-adapter",
      "aerodrome-adapter",
      "lineage-registry",
      "performance-registry",
      "agent-wallet-policy",
    ],
    defaultFees: { protocol: 800, creator: 400, referrer: 200, builder: 100, treasury: 8500 },
  },
  {
    id: "launch-controller",
    name: "Adaptive launch",
    summary: "Capital formation with evidence-driven graduation, not a fixed ETH threshold.",
    primitives: [
      "factory",
      "registry",
      "fee-router",
      "revenue-splitter",
      "referral-router",
      "treasury",
      "access-policy",
      "emergency-pause",
      "liquidity-manager",
      "attribution-registry",
      "lineage-registry",
      "agent-wallet-policy",
    ],
    defaultFees: { protocol: 1000, creator: 2500, referrer: 1500, builder: 500, treasury: 4500 },
  },
  {
    id: "x402-commerce",
    name: "API commerce",
    summary: "Paid APIs with x402 requirements, verifiable receipts and attribution.",
    primitives: [
      "factory",
      "registry",
      "fee-router",
      "revenue-splitter",
      "x402-adapter",
      "access-policy",
      "attribution-registry",
      "lineage-registry",
      "agent-wallet-policy",
    ],
    defaultFees: { protocol: 1500, creator: 2000, referrer: 1000, builder: 500, treasury: 5000 },
  },
  {
    id: "liquidity-router",
    name: "Liquidity router",
    summary: "Quote, route, provision and emergency-exit across verified Base venues.",
    primitives: [
      "factory",
      "registry",
      "swap-adapter",
      "liquidity-manager",
      "aerodrome-adapter",
      "treasury",
      "circuit-breaker",
      "access-policy",
      "lineage-registry",
      "agent-wallet-policy",
    ],
    defaultFees: { protocol: 500, creator: 200, referrer: 100, builder: 200, treasury: 9000 },
  },
  {
    id: "market-instrument",
    name: "Market instrument",
    summary: "Explicit underlying, oracle, payoff, collateral and unwind. No silent semantics.",
    primitives: [
      "factory",
      "registry",
      "oracle-adapter",
      "fee-router",
      "circuit-breaker",
      "emergency-pause",
      "access-policy",
      "lineage-registry",
      "performance-registry",
    ],
    defaultFees: { protocol: 1200, creator: 800, referrer: 200, builder: 300, treasury: 7500 },
  },
  {
    id: "attribution-network",
    name: "Attribution network",
    summary: "Creator → service → distributor → referrer graph with sybil defenses.",
    primitives: [
      "factory",
      "registry",
      "referral-router",
      "revenue-splitter",
      "fee-router",
      "attribution-registry",
      "access-policy",
      "lineage-registry",
    ],
    defaultFees: { protocol: 1000, creator: 3000, referrer: 2500, builder: 500, treasury: 3000 },
  },
];

type CompositionFees = {
  protocol: number;
  creator: number;
  referrer: number;
  builder: number;
  treasury: number;
};

export const AGENTS: Array<{
  id: AgentId;
  name: string;
  mandate: string;
  authority: string;
}> = [
  { id: "scout", name: "Market data ingestion", mandate: "Ingest Base, venue and public signals.", authority: "read-only" },
  { id: "opportunity", name: "Opportunity scoring", mandate: "Score demand. Persist factors.", authority: "write scores" },
  { id: "architect", name: "Venture architecture", mandate: "Map opportunity to archetype.", authority: "propose" },
  { id: "composer", name: "Protocol composition", mandate: "Select hardened modules only.", authority: "compose" },
  { id: "simulator", name: "Scenario simulation", mandate: "BASE/BULL/BEAR/STRESS/ADVERSARIAL.", authority: "simulate" },
  { id: "sentinel", name: "Risk and invariant review", mandate: "Attack surface and invariant review.", authority: "gate" },
  { id: "launch", name: "Deployment coordinator", mandate: "Coordinate bounded deployment.", authority: "require approval" },
  { id: "capital", name: "Capital policy engine", mandate: "Permit capital within policy.", authority: "cap" },
  { id: "liquidity", name: "Liquidity operations", mandate: "Lifecycle of LP and routes.", authority: "cap" },
  { id: "distribution", name: "Distribution workflows", mandate: "Launch and referral workflows.", authority: "propose" },
  { id: "revenue", name: "Revenue accounting", mandate: "Measure real consideration only.", authority: "observe" },
  { id: "treasury", name: "Treasury controls", mandate: "Balances, runway, obligations.", authority: "require approval" },
  { id: "auditor", name: "Performance auditor", mandate: "Outcomes vs assumptions.", authority: "observe" },
  { id: "healing", name: "Recovery controller", mandate: "Detect, contain, repair within bounds.", authority: "bounded repair" },
  { id: "optimization", name: "Optimization controller", mandate: "Bounded improvements.", authority: "propose" },
  { id: "guardian", name: "Guardian", mandate: "Global policy and emergency containment.", authority: "pause" },
  { id: "oracle", name: "Audit oracle", mandate: "Append-only evidence of transitions.", authority: "append" },
];

export const CAPITAL_POLICIES: CapitalPolicy[] = [
  {
    id: "no-unbounded-authority",
    action: "DENY",
    resource: "treasury.unrestricted",
    capUsd: 0,
    reason: "No unrestricted treasury authority is granted to automated execution.",
  },
  {
    id: "vault-canary",
    action: "CAP",
    resource: "yield.deposit",
    capUsd: 2500,
    reason: "Canary TVL until fork evidence and first withdrawal cycle complete.",
  },
  {
    id: "swap-slippage",
    action: "CAP",
    resource: "liquidity.swap",
    capUsd: 1000,
    reason: "Per-tx notional cap until route health ≥ 90.",
  },
  {
    id: "mainnet-deploy",
    action: "REQUIRE_APPROVAL",
    resource: "factory.deploy",
    capUsd: null,
    reason: "Factory bytecode publication on Base requires the deployer key.",
  },
  {
    id: "x402-settle",
    action: "REQUIRE_APPROVAL",
    resource: "commerce.settle",
    capUsd: 50,
    reason: "Settlement requires a verified facilitator receipt, never a mocked payment.",
  },
  {
    id: "emergency",
    action: "PAUSE",
    resource: "system.deposits",
    capUsd: null,
    reason: "Guardian may halt new deposits on invariant failure; withdrawals stay open unless insolvency.",
  },
];

export const COMMERCE_SKUS = [
  {
    id: "intel.opportunity",
    name: "Opportunity analysis",
    description: "Observed Base opportunity metrics with deterministic factor breakdown.",
    usdc: "0.25",
    resource: "/api/v1/intelligence/opportunity",
  },
  {
    id: "sim.stress",
    name: "Economic stress pack",
    description: "Five-scenario simulation for a composition.",
    usdc: "0.50",
    resource: "/api/v1/simulate",
  },
  {
    id: "risk.review",
    name: "Security review",
    description: "Deterministic invariant scan plus sentinel notes.",
    usdc: "0.75",
    resource: "/api/v1/security/review",
  },
  {
    id: "deploy.preview",
    name: "Deployment analysis",
    description: "Calldata preview, fee routing, lineage draft.",
    usdc: "1.00",
    resource: "/api/v1/factory/preview",
  },
] as const;

export function primitiveById(id: string) {
  return PRIMITIVES.find((p) => p.id === id) ?? null;
}

export function archetypeById(id: Archetype) {
  return ARCHETYPES.find((a) => a.id === id) ?? null;
}
