import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadIntelligence, refreshIntelligence, requestBrief } from "@/lib/arclenos/fns";
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
  const [items, setItems] = useState(initial.items);
  const [source, setSource] = useState(initial.source);
  const [error, setError] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(items[0] ?? null);
  const setDraft = useArclenos((s) => s.setDraft);

  async function refresh() {
    setBusy(true);
    try {
      const res = await refreshIntelligence();
      setItems(res.items);
      setSource(res.source);
      setError(res.error);
      setSelected(res.items[0] ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function briefSel() {
    if (!selected) return;
    setBusy(true);
    setBriefErr(null);
    try {
      const res = await requestBrief({ data: { opportunityId: selected.id } });
      if (res.ok) setBrief(res.text);
      else setBriefErr(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="ARCLENØS Intelligence"
      title="Observed demand on Base"
      lede="Scores are calibrated starting weights, not scientific truth. Missing data stays missing."
      actions={
        <Button type="button" variant="secondary" onClick={() => void refresh()} disabled={busy}>
          {busy ? "Ingesting" : "Re-ingest"}
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel>
            <Stat label="Source" value={source || "none"} hint={error ?? "live fetch"} />
          </Panel>
          <Panel>
            <Stat label="Opportunities" value={String(items.length)} />
          </Panel>
          <Panel>
            <Stat
              label="Base block"
              value={initial.chain ? String(initial.chain.blockNumber) : "—"}
              hint={initial.chain ? timeAgo(initial.chain.fetchedAt) : "rpc missed"}
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
                    onClick={() => {
                      setSelected(o);
                      setBrief(null);
                      setBriefErr(null);
                    }}
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
                No observed rows. Telemetry was not fabricated.
              </p>
            ) : null}
          </div>

          <Panel>
            {selected ? (
              <>
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Selected</p>
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
                <div className="mt-5 flex flex-col gap-2">
                  <Button
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
                    <Link to="/factory">Send to Factory</Link>
                  </Button>
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => void briefSel()}>
                    Request Grok brief
                  </Button>
                </div>
                {briefErr ? <p className="mt-3 text-sm text-warn">{briefErr}</p> : null}
                {brief ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{brief}</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a row.</p>
            )}
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
