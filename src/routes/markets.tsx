import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Input, Label } from "@/components/ui/input";

export const Route = createFileRoute("/markets")({
  component: MarketsPage,
});

function payoff(kind: "digital" | "linear" | "covered", spot: number, strike: number, notional: number) {
  if (kind === "digital") return spot >= strike ? notional : 0;
  if (kind === "linear") return Math.max(0, spot - strike) * (notional / Math.max(strike, 1e-9));
  return Math.min(notional, notional * (spot / Math.max(strike, 1e-9)));
}

function MarketsPage() {
  const [kind, setKind] = useState<"digital" | "linear" | "covered">("digital");
  const [spot, setSpot] = useState(3200);
  const [strike, setStrike] = useState(3000);
  const [notional, setNotional] = useState(1000);
  const value = useMemo(() => payoff(kind, spot, strike, notional), [kind, spot, strike, notional]);

  return (
    <Shell
      kicker="ARCLENØS Markets"
      title="Explicit payoff. Explicit unwind."
      lede="Market modules must declare underlying, settlement, oracle, collateral, fee and unwind. No silent financial semantics."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-3 md:grid-cols-3">
          {(
            [
              ["digital", "Digital", "Pays notional if spot ≥ strike at expiry. Binary, collateral-capped."],
              ["linear", "Linear call", "Pays max(0, spot − strike) scaled to notional. Requires oracle + cap."],
              ["covered", "Covered unit", "Pays min(notional, notional × spot/strike). Fully collateralized."],
            ] as const
          ).map(([id, name, copy]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className="rounded-2xl p-1 text-left shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]"
            >
              <div className="rounded-xl bg-card p-5">
                <h3 className="font-serif text-lg">{name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{copy}</p>
                {kind === id ? <p className="mt-3 text-xs uppercase tracking-[0.14em]">Active</p> : null}
              </div>
            </button>
          ))}
        </div>

        <Panel>
          <h2 className="font-serif text-xl">Deterministic payoff tester</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="spot">Spot</Label>
              <Input id="spot" className="mt-2" type="number" value={spot} onChange={(e) => setSpot(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="strike">Strike</Label>
              <Input
                id="strike"
                className="mt-2"
                type="number"
                value={strike}
                onChange={(e) => setStrike(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="notional">Notional</Label>
              <Input
                id="notional"
                className="mt-2"
                type="number"
                value={notional}
                onChange={(e) => setNotional(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Payoff" value={value.toFixed(2)} />
            <Stat label="Oracle" value="required" hint="Stale or zero price reverts" />
            <Stat label="Unwind" value="cancel + settle" hint="No implicit roll" />
          </div>
        </Panel>

        <Panel>
          <h2 className="font-serif text-xl">Required module surface</h2>
          <ul className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {[
              "underlying",
              "settlement asset",
              "pricing assumptions",
              "expiration",
              "oracle + staleness",
              "collateral",
              "payoff function",
              "fee structure",
              "risk bounds",
              "unwind path",
              "telemetry",
            ].map((x) => (
              <li key={x} className="border-t border-border py-2 text-foreground">
                {x}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}
