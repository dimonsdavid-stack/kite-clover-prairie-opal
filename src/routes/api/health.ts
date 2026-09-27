import { createFileRoute } from "@tanstack/react-router";

/** Public, bounded operational status. Configuration never implies live settlement. */
async function health() {
  const checks: Record<string, string> = {
    database: "BLOCKED",
    factory: "UNVERIFIED",
    payments: "UNVERIFIED",
    scheduler: "UNVERIFIED",
  };
  if (process.env.DATABASE_URL) {
    try {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql<{ ok: number }>`select 1::int as ok`;
      checks.database = rows[0]?.ok === 1 ? "READY" : "FAILED";
    } catch {
      checks.database = "FAILED";
    }
  }
  if (process.env.ARCLENOS_FACTORY_ADDRESS && process.env.ARCLENOS_FACTORY_CODE_HASH) {
    try {
      const { getSql } = await import("@/lib/db");
      const { getFactoryHealth } = await import("@/lib/arclenos/deployment/chain");
      const result = await getFactoryHealth(await getSql());
      checks.factory = result.verified && result.operational ? "VERIFIED" : "BLOCKED";
    } catch {
      checks.factory = "BLOCKED";
    }
  }
  if (process.env.DATABASE_URL && process.env.ARCLENOS_TREASURY_ADDRESS &&
      process.env.X402_FACILITATOR_URL && process.env.BASE_RPC_URL &&
      process.env.ARCLENOS_PUBLIC_ORIGIN && process.env.ARCLENOS_INTERNAL_PAYER_ADDRESSES) {
    checks.payments = "CONFIGURED_NOT_COMMISSIONED";
  }
  if (process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 32 && process.env.DATABASE_URL) {
    checks.scheduler = "CONFIGURED_NOT_VERIFIED";
  }
  const ready = checks.database === "READY";
  return Response.json({
    service: "ARCLENOS",
    version: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    status: ready ? "DEGRADED" : "BLOCKED",
    checks,
    note: "Configuration and build health do not constitute audited contracts, live payment, or verified revenue.",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/health")({
  server: { handlers: { GET: health } },
});
