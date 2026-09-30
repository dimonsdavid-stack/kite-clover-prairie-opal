import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadIntelligence } from "@/lib/arclenos/fns";
import { useArclenos } from "@/lib/arclenos/store";
import { compactUsd, pct, timeAgo } from "@/lib/arclenos/format";
import { bandForScore } from "@/lib/arclenos/scoring";
import type { Opportunity } from "@/lib/arclenos/types";

export const Route = createFileRoute("/intelligence")({
  loader: () => loadIntelligence(),
  component: IntelligencePage,
});

function IntelligencePage() {
  const initial = Route.useLoaderData();
  const items = initial.items;
  const [selected, setSelected] = useState<Opportunity | null>(items[0] ?? null);
  const setDraft = useArclenos((s) => s.setDraft);

  return (
    <Shell
      kicker="ARCLENØS Intelligence"
      title="Observed demand on Base"
      lede="Live market observations, transparent factor weights and deterministic scoring. Missing data stays missing."
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel>
            <Stat label="Source" value={initial.source || "none"} hint={initial.error ?? "live fetch"} />
          </Panel>
          <Panel>
            <Stat label="Opportunities" value={String(items.length)} />
          </Panel>
          <Panel>
            <Stat
              label="Base block"
              value={initial.chain ? String(initial.chain.blockNumber) : "—"}
              hint={initial.chain ? timeAgo(initial.chain.fetchedAt) : "rpc unavailable"}
            />
          </Panel>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">TVL</th>
                  <th className="px-4 py-3 font-medium">APY</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-t border-border hover:bg-secondary"
                    onClick={() => setSelected(o)}
                  >
                    <td className="px-4 py-3">
                      <div>{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.protocol}</div>
                    </td>
                    <td className="tape px-4 py-3">{compactUsd(o.tvlUsd)}</td>
                    <td className="tape px-4 py-3">{o.apy == null ? "—" : pct(o.apy)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={bandForScore(o.score) === "PRIORITY" ? "ok" : "idle"}>
                        {o.score.toFixed(1)} {bandForScore(o.score)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground">
                No observed rows are currently available.
              </p>
            ) : null}
          </div>

          <Panel>
            {selected ? (
              <>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Selected opportunity</p>
                <h2 className="mt-2 font-serif text-xl">{selected.title}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{selected.source}</p>
                <dl className="mt-4 space-y-2 text-sm">
                  {Object.entries(selected.factors).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="tape">{v.toFixed(2)}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  className="mt-5 w-full"
                  type="button"
                  onClick={() => {
                    setDraft({
                      opportunityId: selected.id,
                      opportunityTitle: selected.title,
                      name: selected.title,
                      step: 1,
                    });
                  }}
                  asChild
                >
                  <Link to="/factory">Open in Factory</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select an opportunity to inspect its observed factors.</p>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
