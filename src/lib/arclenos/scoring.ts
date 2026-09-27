import type { ScoreFactors } from "./types";

/** Calibrated starting weights. Not scientific truth — updated from observed outcomes. */
export const SCORE_WEIGHTS = {
  demandVelocity: 1,
  monetization: 1,
  distribution: 1,
  capitalEfficiency: 1,
  feasibility: 1,
  defensibility: 1,
  retention: 1,
  competition: 1,
  executionRisk: 1,
} as const;

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function logNorm(value: number, pivot: number) {
  if (value <= 0) return 0;
  return clamp01(Math.log10(1 + value) / Math.log10(1 + pivot));
}

export function factorsFromPool(input: {
  tvlUsd: number | null;
  apy: number | null;
  apyBase: number | null;
  volumeUsd1d: number | null;
  protocol: string;
  exposureCount?: number;
}): ScoreFactors {
  const tvl = input.tvlUsd ?? 0;
  const apy = input.apy ?? 0;
  const vol = input.volumeUsd1d ?? 0;
  const exposure = input.exposureCount ?? 8;

  const demandVelocity = clamp01(0.55 * logNorm(vol, 5_000_000) + 0.45 * logNorm(tvl, 50_000_000));
  const monetization = clamp01(logNorm(Math.max(0, apy) * Math.max(tvl, 1) * 0.01, 2_000_000));
  const distribution = clamp01(0.4 + 0.6 * logNorm(vol, 2_000_000));
  const capitalEfficiency = clamp01(apy > 0 ? logNorm(apy, 40) * (1 - logNorm(tvl, 400_000_000) * 0.3) : 0.15);
  const feasibility = 0.82;
  const defensibility = clamp01(0.35 + logNorm(tvl, 80_000_000) * 0.5);
  const retention = clamp01(0.3 + logNorm(tvl, 60_000_000) * 0.4 + ((input.apyBase ?? 0) > 0 ? 0.15 : 0));
  const competition = clamp01(0.25 + Math.min(0.7, exposure / 20));
  const executionRisk = clamp01(apy > 80 ? 0.75 : apy > 40 ? 0.55 : 0.28);

  return {
    demandVelocity,
    monetization,
    distribution,
    capitalEfficiency,
    feasibility,
    defensibility,
    retention,
    competition,
    executionRisk,
  };
}

export function scoreOpportunity(factors: ScoreFactors, weights = SCORE_WEIGHTS): number {
  const numerator =
    Math.max(factors.demandVelocity, 1e-6) *
    Math.max(factors.monetization, 1e-6) *
    Math.max(factors.distribution, 1e-6) *
    Math.max(factors.capitalEfficiency, 1e-6) *
    Math.max(factors.feasibility, 1e-6) *
    Math.max(factors.defensibility, 1e-6) *
    Math.max(factors.retention, 1e-6);

  const denom = Math.max(factors.competition, 1e-6) * Math.max(factors.executionRisk, 1e-6);
  const raw = numerator / denom;
  const weighted = raw * (weights.demandVelocity * weights.monetization);
  return Math.round(clamp01(Math.log10(1 + weighted * 40) / 2) * 1000) / 10;
}

export function bandForScore(score: number) {
  if (score >= 72) return "PRIORITY";
  if (score >= 55) return "WATCH";
  if (score >= 40) return "MONITOR";
  return "LOW";
}
