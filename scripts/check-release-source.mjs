#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
const p = JSON.parse(readFileSync("package.json", "utf8"));
for (const name of ["@x402/core", "viem", "zod", "@tanstack/react-start"]) {
  if (!p.dependencies?.[name]) throw new Error("Missing runtime dependency: " + name);
}
for (const path of ["contracts/src/ArclenosFactory.sol", "contracts/test/Factory.t.sol",
  "contracts/test/Revenue.t.sol", "src/routes/api/health.ts",
  "src/routes/api/v1/pricing.ts", "src/lib/arclenos/commerce/core.test.ts",
  "src/lib/arclenos/operations/queue.test.ts", "src/lib/arclenos/economics.test.ts"]) {
  if (!existsSync(path)) throw new Error("Missing required source or test: " + path);
}
console.log("Source release structure and direct runtime dependencies: PASS");
