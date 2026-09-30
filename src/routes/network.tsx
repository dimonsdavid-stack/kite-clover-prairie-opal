import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Input, Label } from "@/components/ui/input";
import { loadNetwork } from "@/lib/arclenos/fns";
import { referralQuality } from "@/lib/arclenos/economics";
import { useArclenos } from "@/lib/arclenos/store";

export const Route = createFileRoute("/network")({
  loader: () => loadNetwork(),
  component: NetworkPage,
});

function NetworkPage() {
  const data = Route.useLoaderData();
  const code = useArclenos((s) => s.ensureReferral());
  const [down, setDown] = useState(12);
  const [selfDeal, setSelfDeal] = useState(0);
  const [cycle, setCycle] = useState(false);
  const [organic, setOrganic] = useState(0.6);
  const [repeat, setRepeat] = useState(0.4);
  const q = useMemo(
    () =>
      referralQuality({
        uniqueDownstream: down,
        selfDealRatio: selfDeal,
        cycleDetected: cycle,
        organicRatio: organic,
        repeatRate: repeat,
      }),
    [down, selfDeal, cycle, organic, repeat],
  );

  return (
    <Shell
      kicker="ARCLENØS Network"
      title="Attribution with a quality weight."
      lede="Creator → service → distributor → referrer → LP → builder → customer. Cycles and self-deals zero the reward."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Your code" value={code} hint="Share /refer?code=" />
          </Panel>
          <Panel>
            <Stat label="Tracked codes" value={String(data.referrals.length)} />
          </Panel>
          <Panel>
            <Stat label="Funnel events" value={String(Object.values(data.funnel).reduce((a, n) => a + n, 0))} />
          </Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel>
            <h2 className="font-serif text-xl">Quality calculator</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="down">Unique downstream</Label>
                <Input id="down" className="mt-2" type="number" value={down} onChange={(e) => setDown(Number(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="self">Self-deal ratio</Label>
                <Input
                  id="self"
                  className="mt-2"
                  type="number"
                  step={0.01}
                  value={selfDeal}
                  onChange={(e) => setSelfDeal(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="org">Organic ratio</Label>
                <Input
                  id="org"
                  className="mt-2"
                  type="number"
                  step={0.01}
                  value={organic}
                  onChange={(e) => setOrganic(Number(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="rep">Repeat rate</Label>
                <Input
                  id="rep"
                  className="mt-2"
                  type="number"
                  step={0.01}
                  value={repeat}
                  onChange={(e) => setRepeat(Number(e.target.value))}
                />
              </div>
            </div>
            <label className="mt-4 inline-flex h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={cycle} onChange={(e) => setCycle(e.target.checked)} />
              Cycle detected
            </label>
            <div className="mt-4">
              <Stat label="Quality" value={q.toFixed(1)} hint={q === 0 ? "Denied" : "Weighted 0–100"} />
            </div>
          </Panel>
          <Panel>
            <h2 className="font-serif text-xl">Recorded referrals</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {data.referrals.map((r) => (
                <li key={r.code} className="flex justify-between border-t border-border py-2">
                  <span className="tape">{r.code}</span>
                  <span className="text-muted-foreground">{r.clicks} clicks</span>
                </li>
              ))}
              {data.referrals.length === 0 ? (
                <li className="text-muted-foreground">No tracked referral activity yet.</li>
              ) : null}
            </ul>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
