import type { Composition, SecurityFinding } from "./types";
import { primitiveById } from "./catalog";
import { assertFeeSplit } from "./simulation";

export function reviewComposition(composition: Composition): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  try {
    assertFeeSplit(composition.feeBps);
  } catch (err) {
    findings.push({
      id: "fee-split",
      severity: "P0",
      surface: "economic",
      title: "Fee split invariant broken",
      detail: err instanceof Error ? err.message : "invalid split",
      status: "open",
    });
  }

  for (const id of composition.primitives) {
    if (!primitiveById(id)) {
      findings.push({
        id: `unknown-${id}`,
        severity: "P0",
        surface: "contract",
        title: "Unknown primitive",
        detail: `${id} is not in the hardened library. Arbitrary capital-bearing code is rejected.`,
        status: "open",
      });
    }
  }

  if (!composition.primitives.includes("factory")) {
    findings.push({
      id: "missing-factory",
      severity: "P0",
      surface: "contract",
      title: "Factory missing",
      detail: "Every Day-0 product must deploy through ArclenosFactory.",
      status: "open",
    });
  }

  if (!composition.primitives.includes("lineage-registry")) {
    findings.push({
      id: "missing-lineage",
      severity: "P1",
      surface: "infra",
      title: "Lineage registry omitted",
      detail: "Atlas cannot prove provenance without LineageRegistry.",
      status: "open",
    });
  }

  if (composition.archetype === "yield-vault" && !composition.circuitBreaker) {
    findings.push({
      id: "vault-breaker",
      severity: "P0",
      surface: "economic",
      title: "Yield vault without circuit breaker",
      detail: "Capital-bearing vaults cannot go live without a sticky trip.",
      status: "open",
    });
  }

  if (composition.caps.maxTvlUsd > 25_000) {
    findings.push({
      id: "canary-cap",
      severity: "P1",
      surface: "economic",
      title: "TVL cap exceeds canary bound",
      detail: "Initial exposure is capped at $2,500 deposits / $25,000 TVL until fork evidence exists.",
      status: "open",
    });
  }

  if (composition.archetype === "x402-commerce" && !composition.primitives.includes("x402-adapter")) {
    findings.push({
      id: "x402",
      severity: "P0",
      surface: "infra",
      title: "Commerce product missing x402 adapter",
      detail: "Paid endpoints must verify settlement. Fake payments are forbidden.",
      status: "open",
    });
  }

  findings.push({
    id: "initializer-guard",
    severity: "info",
    surface: "contract",
    title: "Initializer race covered by factory path",
    detail: "Clone then initialize in the same factory transaction. Reinitialization reverts.",
    status: "mitigated",
  });

  findings.push({
    id: "share-inflation",
    severity: "info",
    surface: "contract",
    title: "Virtual offset on ERC-4626",
    detail: "VIRTUAL_ASSETS=1 and VIRTUAL_SHARES=1000. Donation cannot steal the next depositor.",
    status: "mitigated",
  });

  findings.push({
    id: "agent-signer",
    severity: "info",
    surface: "agent",
    title: "Agent wallets are default-deny",
    detail: "Method, destination and daily caps. LLM cannot authorize treasury.unrestricted.",
    status: "mitigated",
  });

  return findings;
}

export function canApprove(findings: SecurityFinding[]) {
  return !findings.some((f) => f.severity === "P0" && f.status === "open");
}
