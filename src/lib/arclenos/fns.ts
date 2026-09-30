import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Composition } from "./types";
import { ARCHETYPES } from "./catalog";

export const compositionSchema = z.object({
  archetype: z.enum([
    "yield-vault",
    "launch-controller",
    "x402-commerce",
    "liquidity-router",
    "market-instrument",
    "attribution-network",
  ]),
  primitives: z.array(z.string().min(1).max(80)).max(30),
  feeBps: z.object({
    protocol: z.number().finite().nonnegative(),
    creator: z.number().finite().nonnegative(),
    referrer: z.number().finite().nonnegative(),
    builder: z.number().finite().nonnegative(),
    treasury: z.number().finite().nonnegative(),
  }),
  caps: z.object({
    maxTvlUsd: z.number().finite().nonnegative(),
    maxDepositUsd: z.number().finite().nonnegative(),
    maxDailyOutflowUsd: z.number().finite().nonnegative(),
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
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("operator");

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
  const { authorizeAction } = await import("./access.server");
  try {
    await authorizeAction("operator");
  } catch (error) {
    const { AccessError } = await import("./access-policy");
    if (error instanceof AccessError && (error.status === 401 || error.status === 403)) {
      return { authorized: false as const, reason: error.message };
    }
    throw error;
  }

  const { operationsBundle } = await import("./runtime.server");
  return { authorized: true as const, ...(await operationsBundle()) };
});

export const loadCapital = createServerFn({ method: "GET" }).handler(async () => {
  // Capital is a read-only evidence surface. Privileged treasury mutations remain
  // separately operator/treasury authorized at their mutation boundaries.
  const { capitalSnapshot, getHealth, listRevenue } = await import("./runtime.server");
  const [health, revenue] = await Promise.all([getHealth(), listRevenue()]);
  return { ...capitalSnapshot(), health, revenue };
});

export const loadNetwork = createServerFn({ method: "GET" }).handler(async () => {
  // Network is a public read-only attribution surface. Referral writes and other
  // mutations retain their own authorization and validation.
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
    treasurySet: Boolean(process.env.ARCLENOS_TREASURY_ADDRESS),
  };
});

export const quoteSku = createServerFn({ method: "POST" })
  .validator(z.object({ skuId: z.string().min(1).max(80) }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("public");

    const { x402Quote } = await import("./runtime.server");
    return x402Quote(data.skuId, "https://arclenos.com");
  });

export const attemptSku = createServerFn({ method: "POST" })
  .validator(z.object({ skuId: z.string().min(1).max(80), payment: z.string().max(16384).nullable() }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("public");

    const { x402SettleAttempt } = await import("./runtime.server");
    return x402SettleAttempt(data.skuId, data.payment, "https://arclenos.com");
  });

export const runCompose = createServerFn({ method: "POST" })
  .validator(
    z.object({
      opportunityId: z.string().max(160).nullable(),
      opportunityTitle: z.string().nullable(),
      archetype: compositionSchema.shape.archetype,
      name: z.string().trim().min(1).max(160),
      composition: compositionSchema,
      createdBy: z.enum(["agent", "operator"]),
    }),
  )
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    const actor = await authorizeAction("operator");

    const { composeVenture } = await import("./runtime.server");
    return composeVenture({
      ...data,
      createdBy: actor.role === "agent" ? "agent" : "operator",
      composition: data.composition as Composition,
    });
  });

export const runHeal = createServerFn({ method: "POST" }).handler(async () => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("operator");

  const { runHealing } = await import("./runtime.server");
  return runHealing();
});

export const runAudit = createServerFn({ method: "POST" }).handler(async () => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("operator");

  const { runDailyAudit } = await import("./runtime.server");
  return runDailyAudit();
});

export const trackFunnel = createServerFn({ method: "POST" })
  .validator(z.object({ name: z.string().trim().min(1).max(160), path: z.string(), meta: z.record(z.string(), z.unknown()).optional() }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("public");

    const { recordFunnel } = await import("./runtime.server");
    await recordFunnel(data.name, data.path, data.meta ?? {});
    return { ok: true as const };
  });

export const trackReferral = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/) }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("public");

    const { clickReferral } = await import("./runtime.server");
    return clickReferral(data.code);
  });

export const requestBrief = createServerFn({ method: "POST" })
  .validator(z.object({ opportunityId: z.string() }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("user");

    const { aiBrief } = await import("./runtime.server");
    return aiBrief(data.opportunityId);
  });

export const simulateNow = createServerFn({ method: "POST" })
  .validator(z.object({ composition: compositionSchema }))
  .handler(async ({ data }) => {
    const { authorizeAction } = await import("./access.server");
    await authorizeAction("public");

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
