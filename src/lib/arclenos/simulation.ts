import type { Composition, ScenarioId, SimulationAssumptions, SimulationResult } from "./types";

export const BASE_ASSUMPTIONS: SimulationAssumptions = {
  usersDay30: 120,
  txPerUserMonth: 4,
  avgNotionalUsd: 420,
  feeBps: 80,
  incentiveBps: 25,
  modelCostUsd: 180,
  infraCostUsd: 90,
  volatility: 0.22,
  drawdown: 0.08,
};

const SCENARIO_SHIFTS: Record<
  ScenarioId,
  { users: number; notional: number; vol: number; dd: number; fail: number; note: string }
> = {
  BASE: { users: 1, notional: 1, vol: 1, dd: 1, fail: 0.04, note: "Observed-like demand, no shock." },
  BULL: { users: 2.4, notional: 1.6, vol: 1.3, dd: 0.7, fail: 0.03, note: "Organic demand compounds; incentives held flat." },
  BEAR: { users: 0.45, notional: 0.7, vol: 1.8, dd: 2.1, fail: 0.09, note: "Volume fades; retention stressed." },
  STRESS: { users: 0.25, notional: 0.5, vol: 2.6, dd: 3.4, fail: 0.18, note: "Correlated exits, gas spike, oracle lag." },
  ADVERSARIAL: { users: 0.15, notional: 0.4, vol: 3.2, dd: 4.2, fail: 0.35, note: "Wash, sandwich, donation, referral loops." },
};

export function simulateComposition(
  composition: Composition,
  assumptions: SimulationAssumptions = BASE_ASSUMPTIONS,
): SimulationResult[] {
  return (Object.keys(SCENARIO_SHIFTS) as ScenarioId[]).map((scenario) => {
    const shift = SCENARIO_SHIFTS[scenario];
    const users = assumptions.usersDay30 * shift.users;
    const notional = assumptions.avgNotionalUsd * shift.notional;
    const tx = users * assumptions.txPerUserMonth;
    const volume = tx * notional;
    const bps = composition.feeBps.protocol + composition.feeBps.creator + composition.feeBps.referrer + composition.feeBps.builder;
    const take = Math.min(bps, 4_000) / 10_000;
    const gross = volume * take * (assumptions.feeBps / 80);
    const incentives = volume * (assumptions.incentiveBps / 10_000) * (scenario === "ADVERSARIAL" ? 1.8 : 1);
    const networkCost = tx * 0.04 * (shift.vol > 2 ? 2.5 : 1);
    const modelCost = assumptions.modelCostUsd * (scenario === "BULL" ? 1.4 : 1);
    const infraCost = assumptions.infraCostUsd;
    const contribution = gross - incentives - networkCost - modelCost - infraCost;
    const tvl = Math.min(composition.caps.maxTvlUsd, volume * 0.35);
    const maxDrawdown = Math.min(0.92, assumptions.drawdown * shift.dd);
    const survival = Math.max(0.05, 1 - shift.fail - maxDrawdown * 0.4);

    const notes = [shift.note];
    if (composition.circuitBreaker) notes.push("Circuit breaker armed; deposits halt on trip.");
    if (scenario === "ADVERSARIAL") notes.push("Referral cycles and self-funded volume excluded from quality weight.");
    if (contribution < 0) notes.push("Contribution negative under this scenario — do not scale capital.");

    return {
      scenario,
      grossRevenue: round2(gross),
      incentives: round2(incentives),
      networkCost: round2(networkCost),
      modelCost: round2(modelCost),
      infraCost: round2(infraCost),
      contribution: round2(contribution),
      tvl: round2(tvl),
      maxDrawdown: round2(maxDrawdown),
      survival: round2(survival),
      notes,
    };
  });
}

export function assertFeeSplit(split: Composition["feeBps"]) {
  const sum = split.protocol + split.creator + split.referrer + split.builder + split.treasury;
  if (sum !== 10_000) {
    throw new Error(`Fee split must sum to 10000 bps, got ${sum}`);
  }
  for (const [k, v] of Object.entries(split)) {
    if (v < 0 || v > 10_000) throw new Error(`Invalid bps for ${k}: ${v}`);
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
