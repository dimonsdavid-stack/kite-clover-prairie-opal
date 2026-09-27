import type { AgentId, VentureStatus } from "./types";

export const LIFECYCLE: VentureStatus[] = [
  "DISCOVERED",
  "QUALIFIED",
  "ARCHITECTED",
  "COMPOSED",
  "SIMULATED",
  "SECURITY_REVIEWED",
  "APPROVED",
  "DEPLOYING",
  "CANARY",
  "LIVE",
  "MONITORED",
  "OPTIMIZING",
];

export const FAILURE_STATES: VentureStatus[] = [
  "REJECTED",
  "QUARANTINED",
  "PAUSED",
  "DEGRADED",
  "ROLLBACK_REQUIRED",
  "HUMAN_APPROVAL_REQUIRED",
];

export const LOOP = [
  "SIGNAL",
  "DISCOVER",
  "SCORE",
  "ARCHITECT",
  "COMPOSE",
  "SIMULATE",
  "SECURE",
  "DEPLOY",
  "CAPITALIZE",
  "LIQUIDITY",
  "DISTRIBUTE",
  "TRANSACT",
  "MONETIZE",
  "OBSERVE",
  "AUDIT",
  "HEAL",
  "OPTIMIZE",
  "COMPOUND",
] as const;

export const AGENT_SEQUENCE: Array<{ agent: AgentId; to: VentureStatus; reason: string }> = [
  { agent: "scout", to: "DISCOVERED", reason: "Signal ingested from live Base / venue telemetry." },
  { agent: "opportunity", to: "QUALIFIED", reason: "Opportunity scored from observed factors." },
  { agent: "architect", to: "ARCHITECTED", reason: "Mapped to a hardened product archetype." },
  { agent: "composer", to: "COMPOSED", reason: "Selected primitives from the library. No invented bytecode." },
  { agent: "simulator", to: "SIMULATED", reason: "BASE / BULL / BEAR / STRESS / ADVERSARIAL completed." },
  { agent: "sentinel", to: "SECURITY_REVIEWED", reason: "Invariant scan finished. P0s gate approval." },
  { agent: "guardian", to: "APPROVED", reason: "No open P0. Canary caps in force." },
  { agent: "launch", to: "CANARY", reason: "Lineage registered. Mainnet publication requires the deployer key." },
];

export function statusTone(status: VentureStatus): "ok" | "warn" | "bad" | "idle" {
  if (status === "LIVE" || status === "MONITORED" || status === "OPTIMIZING" || status === "CANARY" || status === "APPROVED") {
    return "ok";
  }
  if (status === "HUMAN_APPROVAL_REQUIRED" || status === "DEGRADED" || status === "PAUSED" || status === "DEPLOYING") {
    return "warn";
  }
  if (status === "REJECTED" || status === "QUARANTINED" || status === "ROLLBACK_REQUIRED") {
    return "bad";
  }
  return "idle";
}
