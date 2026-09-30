import { createFileRoute } from "@tanstack/react-router";

type ReadinessCheck = "BLOCKED" | "FAILED" | "UNVERIFIED" | "CONFIGURED_NOT_COMMISSIONED" | "CONFIGURED_NOT_VERIFIED" | "VERIFIED" | "READY";

const SCHEDULER_FRESHNESS_MS = 35 * 60 * 1000;

/**
 * Public, bounded operational readiness.
 *
 * READY is evidence-based: configuration alone never promotes Factory,
 * Payments, or Scheduler to a commissioned state.
 */
async function health() {
  const checks: Record<string, ReadinessCheck> = {
    database: "BLOCKED",
    factory: "UNVERIFIED",
    payments: "UNVERIFIED",
    scheduler: "UNVERIFIED",
  };
  const evidence: Record<string, unknown> = {
    settledCustomerPayments: 0,
    schedulerLastSuccess: null,
  };

  let sql: Awaited<ReturnType<typeof import("@/lib/db")["getSql"]>> | null = null;

  if (process.env.DATABASE_URL) {
    try {
      const { getSql } = await import("@/lib/db");
      sql = await getSql();
      const rows = await sql<{ ok: number }>`select 1::int as ok`;
      checks.database = rows[0]?.ok === 1 ? "READY" : "FAILED";
    } catch {
      checks.database = "FAILED";
      sql = null;
    }
  }

  if (sql && process.env.ARCLENOS_FACTORY_ADDRESS && process.env.ARCLENOS_FACTORY_CODE_HASH) {
    try {
      const { getFactoryHealth } = await import("@/lib/arclenos/deployment/chain");
      const result = await getFactoryHealth(sql);
      checks.factory = result.verified && result.operational ? "VERIFIED" : "BLOCKED";
      evidence.factoryCheckedAt = result.checkedAt;
    } catch {
      checks.factory = "BLOCKED";
    }
  }

  const commerceConfigured = Boolean(
    process.env.DATABASE_URL &&
    process.env.ARCLENOS_TREASURY_ADDRESS &&
    process.env.X402_FACILITATOR_URL &&
    process.env.BASE_RPC_URL &&
    process.env.ARCLENOS_PUBLIC_ORIGIN &&
    process.env.ARCLENOS_INTERNAL_PAYER_ADDRESSES
  );

  if (commerceConfigured && sql) {
    try {
      const rows = await sql<{ n: number }>`
        select count(*)::int as n
        from revenue_events
        where classification = 'x402'
          and confirmation_status = 'SETTLED'
          and economic_valid = true
      `;
      const settled = rows[0]?.n ?? 0;
      evidence.settledCustomerPayments = settled;
      checks.payments = settled > 0 ? "VERIFIED" : "CONFIGURED_NOT_COMMISSIONED";
    } catch {
      checks.payments = "CONFIGURED_NOT_COMMISSIONED";
    }
  }

  const schedulerConfigured = Boolean(
    process.env.CRON_SECRET &&
    process.env.CRON_SECRET.length >= 32 &&
    process.env.DATABASE_URL
  );

  if (schedulerConfigured && sql) {
    try {
      const rows = await sql<{ last_success: string | Date | null }>`
        select last_success
        from operation_health
        where adapter = 'scheduler'
        limit 1
      `;
      const last = rows[0]?.last_success ?? null;
      const lastMs = last ? new Date(last).getTime() : Number.NaN;
      const fresh = Number.isFinite(lastMs) && Date.now() - lastMs <= SCHEDULER_FRESHNESS_MS;
      evidence.schedulerLastSuccess = last ? new Date(last).toISOString() : null;
      checks.scheduler = fresh ? "VERIFIED" : "CONFIGURED_NOT_VERIFIED";
    } catch {
      checks.scheduler = "CONFIGURED_NOT_VERIFIED";
    }
  }

  const ready =
    checks.database === "READY" &&
    checks.factory === "VERIFIED" &&
    checks.payments === "VERIFIED" &&
    checks.scheduler === "VERIFIED";

  const databaseAvailable = checks.database === "READY";
  const remaining = Object.entries(checks)
    .filter(([, value]) => !["READY", "VERIFIED"].includes(value))
    .map(([key]) => key);

  return Response.json({
    service: "ARCLENOS",
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    status: ready ? "READY" : databaseAvailable ? "DEGRADED" : "BLOCKED",
    checks,
    evidence,
    commissioning: {
      readyForUnattendedClientAdoption: ready,
      remaining,
    },
    note: ready
      ? "All production readiness gates have current evidence."
      : "Configuration and build health do not constitute live factory, scheduler, payment, or revenue evidence.",
    time: new Date().toISOString(),
  }, {
    status: databaseAvailable ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: health } },
});
