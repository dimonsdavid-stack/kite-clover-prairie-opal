#!/usr/bin/env node
/** Non-mutating live smoke check. Never exercises paid transactions. */
const base = process.argv[2] ?? process.env.ARCLENOS_SMOKE_URL;
if (!base) {
  console.error("Usage: npm run smoke:live -- https://verified-staging.example");
  process.exit(2);
}
const origin = new URL(base);
if (origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) {
  console.error("Smoke target must use HTTPS (except local development)");
  process.exit(2);
}
let failures = 0;
async function check(path, validate) {
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { accept: path === "/" ? "text/html" : "application/json" },
    });
    const body = await response.text();
    const result = validate(response, body);
    console.log(JSON.stringify({ path, status: response.status, result: result ? "PASS" : "FAIL", url: response.url }));
    if (!result) failures++;
  } catch (error) {
    failures++;
    console.log(JSON.stringify({ path, result: "FAIL", error: error instanceof Error ? error.name : "UNKNOWN" }));
  }
}
await check("/", (r, b) => r.status === 200 && /ARCLEN(?:Ø|O)S/i.test(b) && !/DeFAI C2 Trading Station/i.test(b));
await check("/api/health", (r, b) => {
  if (![200, 503].includes(r.status)) return false;
  const o = JSON.parse(b);
  return o.service === "ARCLENOS" && o.checks && typeof o.checks.database === "string";
});
await check("/api/v1/pricing", (r, b) => {
  if (![200, 503].includes(r.status)) return false;
  const o = JSON.parse(b);
  return Array.isArray(o.skus) || o.error === "SERVICE_UNAVAILABLE";
});
if (failures) {
  console.error("Production route smoke failed; do not promote this deployment.");
  process.exit(1);
}
console.log("Read-only smoke passed. Live payments, contracts and revenue remain separately gated.");
