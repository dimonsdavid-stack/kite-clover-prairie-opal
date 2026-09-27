/** Deterministic vault, fee and launch math. LLM never overrides these. */

export const VIRTUAL_ASSETS = 1n;
export const DECIMAL_OFFSET = 3n;
export const VIRTUAL_SHARES = 10n ** DECIMAL_OFFSET;

export function convertToShares(assets: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (assets < 0n || totalAssets < 0n || totalSupply < 0n) throw new Error("negative");
  return (assets * (totalSupply + VIRTUAL_SHARES)) / (totalAssets + VIRTUAL_ASSETS);
}

export function convertToAssets(shares: bigint, totalAssets: bigint, totalSupply: bigint): bigint {
  if (shares < 0n || totalAssets < 0n || totalSupply < 0n) throw new Error("negative");
  return (shares * (totalAssets + VIRTUAL_ASSETS)) / (totalSupply + VIRTUAL_SHARES);
}

export function splitBps(amount: bigint, bps: number): bigint {
  if (bps < 0 || bps > 10_000) throw new Error("bps out of range");
  return (amount * BigInt(bps)) / 10_000n;
}

export type LaunchMetrics = {
  uniqueEconomicUsers: number;
  capitalCommittedUsd: number;
  reserveDepthUsd: number;
  holderHhi: number;
  organicTxVelocity: number;
  organicRatio: number;
  referralDiversity: number;
  liquidityDemand: number;
  priceImpactBps: number;
  washProbability: number;
  expectedDexDepthUsd: number;
  volatility: number;
  treasuryRunwayDays: number;
  txFailureRate: number;
};

export type Graduation = {
  score: number;
  graduated: boolean;
  reasons: string[];
  blockers: string[];
};

export function adaptiveGraduation(m: LaunchMetrics): Graduation {
  const reasons: string[] = [];
  const blockers: string[] = [];

  const users = clamp01(m.uniqueEconomicUsers / 80);
  const capital = clamp01(Math.log10(1 + m.capitalCommittedUsd) / 6);
  const reserve = clamp01(Math.log10(1 + m.reserveDepthUsd) / 6);
  const concentration = 1 - clamp01(m.holderHhi);
  const organic = clamp01(m.organicRatio) * clamp01(m.organicTxVelocity / 40);
  const referrals = clamp01(m.referralDiversity);
  const liq = clamp01(m.liquidityDemand) * clamp01(m.expectedDexDepthUsd / 250_000);
  const impact = 1 - clamp01(m.priceImpactBps / 300);
  const wash = 1 - clamp01(m.washProbability);
  const vol = 1 - clamp01((m.volatility - 0.2) / 1.2);
  const runway = clamp01(m.treasuryRunwayDays / 90);
  const reliability = 1 - clamp01(m.txFailureRate);

  if (m.uniqueEconomicUsers < 25) blockers.push("Unique economic users below 25.");
  if (m.organicRatio < 0.45) blockers.push("Organic/incentivized ratio below 0.45.");
  if (m.washProbability > 0.35) blockers.push("Wash probability above 0.35.");
  if (m.holderHhi > 0.35) blockers.push("Holder concentration (HHI) above 0.35.");
  if (m.txFailureRate > 0.08) blockers.push("Transaction failure rate above 8%.");
  if (m.priceImpactBps > 180) blockers.push("Expected DEX price impact above 180 bps.");

  const score =
    100 *
    (0.14 * users +
      0.12 * capital +
      0.1 * reserve +
      0.1 * concentration +
      0.12 * organic +
      0.08 * referrals +
      0.1 * liq +
      0.08 * impact +
      0.06 * wash +
      0.04 * vol +
      0.03 * runway +
      0.03 * reliability);

  if (users > 0.5) reasons.push("User breadth supporting distribution.");
  if (organic > 0.4) reasons.push("Organic velocity dominating incentives.");
  if (concentration > 0.6) reasons.push("Holder set is not a single cluster.");
  if (blockers.length === 0) reasons.push("No hard graduation blocker is currently tripped.");

  const graduated = blockers.length === 0 && score >= 62;
  return { score: Math.round(score * 10) / 10, graduated, reasons, blockers };
}

export function referralQuality(input: {
  uniqueDownstream: number;
  selfDealRatio: number;
  cycleDetected: boolean;
  organicRatio: number;
  repeatRate: number;
}): number {
  if (input.cycleDetected) return 0;
  if (input.selfDealRatio > 0.2) return 0;
  const breadth = clamp01(input.uniqueDownstream / 40);
  return Math.round((0.4 * breadth + 0.35 * clamp01(input.organicRatio) + 0.25 * clamp01(input.repeatRate)) * 1000) / 10;
}

export function healthBand(score: number): "HEALTHY" | "DEGRADED" | "RESTRICTED" | "CONTAIN" {
  if (score >= 90) return "HEALTHY";
  if (score >= 75) return "DEGRADED";
  if (score >= 50) return "RESTRICTED";
  return "CONTAIN";
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
