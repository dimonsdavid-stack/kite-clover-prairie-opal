import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { adaptiveGraduation, type LaunchMetrics } from "@/lib/arclenos/economics";

export const Route = createFileRoute("/launch")({
  component: LaunchPage,
});

const FIELDS: Array<{ key: keyof LaunchMetrics; label: string; step?: number }> = [
  { key: "uniqueEconomicUsers", label: "Unique economic users" },
  { key: "capitalCommittedUsd", label: "Capital committed USD" },
  { key: "reserveDepthUsd", label: "Reserve depth USD" },
  { key: "holderHhi", label: "Holder HHI", step: 0.01 },
  { key: "organicTxVelocity", label: "Organic tx velocity" },
  { key: "organicRatio", label: "Organic ratio", step: 0.01 },
  { key: "referralDiversity", label: "Referral diversity", step: 0.01 },
  { key: "liquidityDemand", label: "Liquidity demand", step: 0.01 },
  { key: "priceImpactBps", label: "Price impact bps" },
  { key: "washProbability", label: "Wash probability", step: 0.01 },
  { key: "expectedDexDepthUsd", label: "Expected DEX depth USD" },
  { key: "volatility", label: "Volatility", step: 0.01 },
  { key: "treasuryRunwayDays", label: "Treasury runway days" },
  { key: "txFailureRate", label: "Tx failure rate", step: 0.01 },
];

function LaunchPage() {
  const [m, setM] = useState<LaunchMetrics>({
    uniqueEconomicUsers: 12,
    capitalCommittedUsd: 18000,
    reserveDepthUsd: 9000,
    holderHhi: 0.42,
    organicTxVelocity: 8,
    organicRatio: 0.3,
    referralDiversity: 0.2,
    liquidityDemand: 0.25,
    priceImpactBps: 210,
    washProbability: 0.4,
    expectedDexDepthUsd: 12000,
    volatility: 0.8,
    treasuryRunwayDays: 14,
    txFailureRate: 0.05,
  });
  const g = useMemo(() => adaptiveGraduation(m), [m]);

  return (
    <Shell
      kicker="ARCLENØS Launch"
      title="Adaptive graduation. No 42 ETH doctrine."
      lede="Capital formation graduates when users, organic flow, depth and integrity clear gates — not when a single reserve threshold is hit."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Graduation score" value={g.score.toFixed(1)} />
          </Panel>
          <Panel>
            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Decision</div>
            <div className="mt-2">
              <Badge tone={g.graduated ? "ok" : "warn"}>{g.graduated ? "Graduate" : "Hold"}</Badge>
            </div>
          </Panel>
          <Panel>
            <Stat label="Blockers" value={String(g.blockers.length)} />
          </Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Panel>
            <h2 className="font-serif text-xl">Controller inputs</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  <Input
                    id={f.key}
                    className="mt-2"
                    type="number"
                    step={f.step ?? 1}
                    value={m[f.key]}
                    onChange={(e) => setM({ ...m, [f.key]: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </Panel>
          <div className="space-y-4">
            <Panel>
              <h3 className="font-serif text-lg">Reasons</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {g.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {g.reasons.length === 0 ? <li>No supporting reason yet.</li> : null}
              </ul>
            </Panel>
            <Panel>
              <h3 className="font-serif text-lg">Blockers</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {g.blockers.map((r) => (
                  <li key={r}>{r}</li>
                ))}
                {g.blockers.length === 0 ? <li>None tripped.</li> : null}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </Shell>
  );
}
