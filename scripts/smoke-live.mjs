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

async function check(path, validate, accept = "text/html") {
  try {
    const response = await fetch(new URL(path, origin), {
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
      headers: { accept },
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

const publicRoutes = [
  "/",
  "/atlas",
  "/capital",
  "/commerce",
  "/developers",
  "/docs",
  "/factory",
  "/guardstate",
  "/intelligence",
  "/launch",
  "/liquidity",
  "/login",
  "/markets",
  "/network",
  "/operations",
  "/pricing",
  "/refer",
  "/yield",
  "/atlas/not-a-real-venture-id",
];

for (const path of publicRoutes) {
  await check(path, (r, b) => {
    if (r.status !== 200) return false;
    if (!/ARCLEN(?:Ø|O)S/i.test(b)) return false;
    if (/DeFAI C2 Trading Station/i.test(b)) return false;
    if (/Something went wrong|Internal Server Error/i.test(b)) return false;
    if (/Request Grok|Created with Grok|grok\.com|\/__grok\/|grok-project-id|old prompt/i.test(b)) return false;
    return true;
  });
}

await check("/operations", (r, b) =>
  r.status === 200 && /Operator authorization required/i.test(b) && !/Something went wrong/i.test(b)
);

await check("/intelligence", (r, b) =>
  r.status === 200 &&
  /Open in Factory/i.test(b) &&
  !/Request Grok|Grok brief|grok\.com|\/__grok\//i.test(b)
);

await check("/liquidity", (r, b) =>
  r.status === 200 &&
  /Runtime bytecode/i.test(b) &&
  /CODE PRESENT|NO CODE/i.test(b) &&
  !/Verified venues|Catalog bytecode/i.test(b)
);

await check("/__grok/manifest.webmanifest", (r, b) =>
  r.status === 404 && !/Grok App|grok\.com/i.test(b)
);

await check("/api/health", (r, b) => {
  if (![200, 503].includes(r.status)) return false;
  const o = JSON.parse(b);
  return o.service === "ARCLENOS" && o.checks && typeof o.checks.database === "string";
}, "application/json");

await check("/api/v1/pricing", (r, b) => {
  if (![200, 503].includes(r.status)) return false;
  const o = JSON.parse(b);
  return Array.isArray(o.skus) || o.error === "SERVICE_UNAVAILABLE";
}, "application/json");

if (failures) {
  console.error("Production route smoke failed; do not promote this deployment.");
  process.exit(1);
}
console.log("Read-only route smoke passed. Live payments, contracts and revenue remain separately gated.");
