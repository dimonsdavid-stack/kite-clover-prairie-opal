export const CHAIN_ID_BASE = 8453;
export const CHAIN_NAME = "Base";

export type ProductFamily =
  | "factory"
  | "intelligence"
  | "yield"
  | "markets"
  | "launch"
  | "commerce"
  | "liquidity"
  | "network"
  | "atlas"
  | "api"
  | "capital"
  | "guardstate";

export type Archetype =
  | "yield-vault"
  | "launch-controller"
  | "x402-commerce"
  | "liquidity-router"
  | "market-instrument"
  | "attribution-network";

export type VentureStatus =
  | "DISCOVERED"
  | "QUALIFIED"
  | "ARCHITECTED"
  | "COMPOSED"
  | "SIMULATED"
  | "SECURITY_REVIEWED"
  | "APPROVED"
  | "DEPLOYING"
  | "CANARY"
  | "LIVE"
  | "MONITORED"
  | "OPTIMIZING"
  | "REJECTED"
  | "QUARANTINED"
  | "PAUSED"
  | "DEGRADED"
  | "ROLLBACK_REQUIRED"
  | "HUMAN_APPROVAL_REQUIRED";

export type AgentId =
  | "scout"
  | "opportunity"
  | "architect"
  | "composer"
  | "simulator"
  | "sentinel"
  | "launch"
  | "capital"
  | "liquidity"
  | "distribution"
  | "revenue"
  | "treasury"
  | "auditor"
  | "healing"
  | "optimization"
  | "guardian"
  | "oracle";

export type HealthBand = "HEALTHY" | "DEGRADED" | "RESTRICTED" | "CONTAIN";

export type PolicyAction = "ALLOW" | "DENY" | "REQUIRE_APPROVAL" | "CAP" | "PAUSE";

export type ScenarioId = "BASE" | "BULL" | "BEAR" | "STRESS" | "ADVERSARIAL";

export type Verification = "VERIFIED" | "FAILED" | "BLOCKED" | "NOT_APPLICABLE";

export type ScoreFactors = {
  demandVelocity: number;
  monetization: number;
  distribution: number;
  capitalEfficiency: number;
  feasibility: number;
  defensibility: number;
  retention: number;
  competition: number;
  executionRisk: number;
};

export type Opportunity = {
  id: string;
  source: string;
  title: string;
  protocol: string;
  symbol: string;
  chainId: number;
  tvlUsd: number | null;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  volumeUsd1d: number | null;
  score: number;
  factors: ScoreFactors;
  poolAddress: string | null;
  url: string | null;
  updatedAt: string;
};

export type Primitive = {
  id: string;
  name: string;
  version: string;
  category: string;
  summary: string;
  invariants: string[];
  requiredBy: Archetype[];
};

export type Composition = {
  archetype: Archetype;
  primitives: string[];
  feeBps: {
    protocol: number;
    creator: number;
    referrer: number;
    builder: number;
    treasury: number;
  };
  caps: {
    maxTvlUsd: number;
    maxDepositUsd: number;
    maxDailyOutflowUsd: number;
  };
  pauseGuards: boolean;
  circuitBreaker: boolean;
};

export type SimulationAssumptions = {
  usersDay30: number;
  txPerUserMonth: number;
  avgNotionalUsd: number;
  feeBps: number;
  incentiveBps: number;
  modelCostUsd: number;
  infraCostUsd: number;
  volatility: number;
  drawdown: number;
};

export type SimulationResult = {
  scenario: ScenarioId;
  grossRevenue: number;
  incentives: number;
  networkCost: number;
  modelCost: number;
  infraCost: number;
  contribution: number;
  tvl: number;
  maxDrawdown: number;
  survival: number;
  notes: string[];
};

export type SecurityFinding = {
  id: string;
  severity: "P0" | "P1" | "P2" | "info";
  surface: "contract" | "agent" | "infra" | "economic";
  title: string;
  detail: string;
  status: "open" | "mitigated" | "accepted";
};

export type Venture = {
  id: string;
  name: string;
  archetype: Archetype;
  status: VentureStatus;
  opportunityId: string | null;
  config: Record<string, unknown>;
  composition: Composition | null;
  simulation: SimulationResult[] | null;
  security: SecurityFinding[] | null;
  lineage: {
    parentId: string | null;
    primitiveVersions: Record<string, string>;
    createdBy: "agent" | "operator";
  };
  riskStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentRun = {
  id: string;
  agent: AgentId;
  ventureId: string | null;
  from: VentureStatus | null;
  to: VentureStatus | null;
  reason: string;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export type HealthComponent = {
  id: string;
  label: string;
  score: number;
  band: HealthBand;
  detail: string;
};

export type HealthReport = {
  overall: number;
  band: HealthBand;
  components: HealthComponent[];
  generatedAt: string;
  chainId: number | null;
  blockNumber: number | null;
};

export type ChainSnapshot = {
  chainId: number;
  blockNumber: number;
  blockHash: string | null;
  timestamp: number | null;
  rpc: string;
  contracts: ContractCheck[];
  fetchedAt: string;
};

export type ContractCheck = {
  name: string;
  address: string;
  source: string;
  hasCode: boolean;
  verification: Verification;
};

export type CapitalPolicy = {
  id: string;
  action: PolicyAction;
  resource: string;
  capUsd: number | null;
  reason: string;
};

export type AttributionNode = {
  role:
    | "creator"
    | "agent"
    | "strategy-author"
    | "distributor"
    | "referrer"
    | "lp"
    | "builder"
    | "customer";
  id: string;
  weight: number;
  quality: number;
};

export type RevenueEvent = {
  id: string;
  product: ProductFamily;
  amountUsd: number;
  asset: string;
  txId: string | null;
  classification: "protocol-fee" | "x402" | "factory" | "api" | "blocked";
  attribution: string | null;
  createdAt: string;
};

export type X402Requirement = {
  x402Version: 1;
  error: "PAYMENT_REQUIRED";
  accepts: Array<{
    scheme: "exact";
    network: "base";
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra: { name: string; version: string };
  }>;
};
