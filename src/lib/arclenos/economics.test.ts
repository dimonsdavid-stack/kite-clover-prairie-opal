import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VIRTUAL_ASSETS,
  VIRTUAL_SHARES,
  adaptiveGraduation,
  convertToAssets,
  convertToShares,
  referralQuality,
  splitBps,
} from "./economics.ts";
import { factorsFromPool, scoreOpportunity } from "./scoring.ts";
import { assertFeeSplit, simulateComposition } from "./simulation.ts";
import { ARCHETYPES } from "./catalog.ts";

describe("erc4626 virtual offset", () => {
  it("mints a first depositor a near 1:1 share without a free lunch", () => {
    const shares = convertToShares(1_000_000n, 0n, 0n);
    assert.equal(shares, (1_000_000n * VIRTUAL_SHARES) / VIRTUAL_ASSETS);
    const assets = convertToAssets(shares, 1_000_000n, shares);
    assert.equal(assets, 1_000_000n);
  });

  it("donation cannot steal the next depositor", () => {
    const firstAssets = 1_000_000n;
    const firstShares = convertToShares(firstAssets, 0n, 0n);
    const donated = 1_000_000_000n;
    const totalAssets = firstAssets + donated;
    const attackerShares = convertToShares(1n, totalAssets, firstShares);
    assert.equal(attackerShares, 0n);
    const victimAssets = 1_000_000n;
    const victimShares = convertToShares(victimAssets, totalAssets, firstShares);
    assert.ok(victimShares > 0n);
    const victimOut = convertToAssets(victimShares, totalAssets + victimAssets, firstShares + victimShares);
    assert.ok(victimOut >= victimAssets - 2n);
  });
});

describe("fees", () => {
  it("rejects splits that do not sum to 10000", () => {
    assert.throws(() =>
      assertFeeSplit({ protocol: 500, creator: 500, referrer: 0, builder: 0, treasury: 1000 }),
    );
    assert.doesNotThrow(() =>
      assertFeeSplit({ protocol: 800, creator: 400, referrer: 200, builder: 100, treasury: 8500 }),
    );
  });

  it("splits bps without remainder leakage above 1 unit", () => {
    const amount = 1_000_000n;
    const parts = [800, 400, 200, 100, 8500].map((b) => splitBps(amount, b));
    const sum = parts.reduce((a, b) => a + b, 0n);
    assert.ok(amount - sum <= 5n);
  });
});

describe("graduation", () => {
  it("does not graduate on a 42 ETH-style single threshold", () => {
    const poor = adaptiveGraduation({
      uniqueEconomicUsers: 3,
      capitalCommittedUsd: 42 * 3000,
      reserveDepthUsd: 42 * 3000,
      holderHhi: 0.9,
      organicTxVelocity: 2,
      organicRatio: 0.1,
      referralDiversity: 0.05,
      liquidityDemand: 0.2,
      priceImpactBps: 400,
      washProbability: 0.6,
      expectedDexDepthUsd: 4_000,
      volatility: 1.4,
      treasuryRunwayDays: 3,
      txFailureRate: 0.2,
    });
    assert.equal(poor.graduated, false);
    assert.ok(poor.blockers.length > 0);
  });

  it("graduates when breadth, organic flow and depth clear gates", () => {
    const good = adaptiveGraduation({
      uniqueEconomicUsers: 90,
      capitalCommittedUsd: 180_000,
      reserveDepthUsd: 220_000,
      holderHhi: 0.12,
      organicTxVelocity: 55,
      organicRatio: 0.72,
      referralDiversity: 0.6,
      liquidityDemand: 0.7,
      priceImpactBps: 40,
      washProbability: 0.08,
      expectedDexDepthUsd: 400_000,
      volatility: 0.28,
      treasuryRunwayDays: 120,
      txFailureRate: 0.01,
    });
    assert.equal(good.graduated, true);
  });
});

describe("referral quality", () => {
  it("zeros cycles and self-deals", () => {
    assert.equal(
      referralQuality({
        uniqueDownstream: 40,
        selfDealRatio: 0,
        cycleDetected: true,
        organicRatio: 1,
        repeatRate: 1,
      }),
      0,
    );
    assert.equal(
      referralQuality({
        uniqueDownstream: 40,
        selfDealRatio: 0.5,
        cycleDetected: false,
        organicRatio: 1,
        repeatRate: 1,
      }),
      0,
    );
  });
});

describe("opportunity score", () => {
  it("is bounded 0-100 and rises with real demand", () => {
    const low = scoreOpportunity(
      factorsFromPool({ tvlUsd: 12_000, apy: 2, apyBase: 2, volumeUsd1d: 400, protocol: "x" }),
    );
    const high = scoreOpportunity(
      factorsFromPool({
        tvlUsd: 80_000_000,
        apy: 12,
        apyBase: 8,
        volumeUsd1d: 9_000_000,
        protocol: "aerodrome",
      }),
    );
    assert.ok(low >= 0 && low <= 100);
    assert.ok(high >= 0 && high <= 100);
    assert.ok(high > low);
  });
});

describe("simulation", () => {
  it("emits five scenarios and flags adversarial loss", () => {
    const arch = ARCHETYPES[0];
    const results = simulateComposition({
      archetype: arch.id,
      primitives: arch.primitives,
      feeBps: arch.defaultFees,
      caps: { maxTvlUsd: 25_000, maxDepositUsd: 2_500, maxDailyOutflowUsd: 5_000 },
      pauseGuards: true,
      circuitBreaker: true,
    });
    assert.equal(results.length, 5);
    assert.ok(results.every((r) => r.scenario));
  });
});
