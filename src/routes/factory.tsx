import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ARCHETYPES, PRIMITIVES, primitiveById } from "@/lib/arclenos/catalog";
import { loadFactory, runCompose, simulateNow } from "@/lib/arclenos/fns";
import { useArclenos } from "@/lib/arclenos/store";
import { usd, pct } from "@/lib/arclenos/format";
import { assertFeeSplit } from "@/lib/arclenos/simulation";
import type { Archetype, Composition, SimulationResult, SecurityFinding } from "@/lib/arclenos/types";

export const Route = createFileRoute("/factory")({
  loader: () => loadFactory(),
  component: FactoryPage,
});

const STEPS = ["Opportunity", "Archetype", "Economics", "Simulate", "Security", "Registration"];

function FactoryPage() {
  const intel = Route.useLoaderData();
  const draft = useArclenos((s) => s.draft);
  const setDraft = useArclenos((s) => s.setDraft);
  const resetDraft = useArclenos((s) => s.resetDraft);
  const [busy, setBusy] = useState(false);
  const [sim, setSim] = useState<SimulationResult[] | null>(null);
  const [sec, setSec] = useState<SecurityFinding[] | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [ventureId, setVentureId] = useState<string | null>(draft.ventureId);

  const feeError = useMemo(() => {
    try {
      assertFeeSplit(draft.composition.feeBps);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Invalid fees";
    }
  }, [draft.composition.feeBps]);

  function setArch(id: Archetype) {
    const a = ARCHETYPES.find((x) => x.id === id);
    if (!a) return;
    setDraft({
      archetype: id,
      composition: {
        ...draft.composition,
        archetype: id,
        primitives: a.primitives,
        feeBps: { ...a.defaultFees },
      },
    });
  }

  function setFee(key: keyof Composition["feeBps"], raw: number) {
    const n = Math.max(0, Math.min(10_000, Math.round(raw)));
    const feeBps = { ...draft.composition.feeBps, [key]: n };
    if (key !== "treasury") {
      const used = feeBps.protocol + feeBps.creator + feeBps.referrer + feeBps.builder;
      feeBps.treasury = 10_000 - used;
    }
    setDraft({ composition: { ...draft.composition, feeBps } });
  }

  async function onSimulate() {
    setBusy(true);
    try {
      const res = await simulateNow({ data: { composition: draft.composition } });
      setSim(res.simulation);
      setSec(res.security);
      setDraft({ step: 4, status: "SIMULATED" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCompose() {
    setBusy(true);
    try {
      const res = await runCompose({
        data: {
          opportunityId: draft.opportunityId,
          opportunityTitle: draft.opportunityTitle,
          archetype: draft.archetype,
          name: draft.name,
          composition: draft.composition,
          createdBy: "operator",
        },
      });
      setVentureId(res.venture.id);
      setBlocked(res.blocked);
      setSec(res.venture.security);
      setSim(res.venture.simulation);
      setDraft({ step: 5, status: res.venture.status, ventureId: res.venture.id });
      toast.message(res.venture.status === "CANARY" ? "Canary registered" : "Held by risk gate");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Compose failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="ARCLENØS Factory"
      title="Select. Parameterize. Simulate. Review."
      lede="Explore compositions from a hardened primitive library, test economics and review risk controls. Canary registration remains restricted to authorized operators."
      actions={
        <Button type="button" variant="ghost" size="sm" onClick={() => { resetDraft(); setSim(null); setSec(null); setBlocked(null); setVentureId(null); }}>
          Reset draft
        </Button>
      }
    >
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[240px_1fr]">
        <ol className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm hover:bg-secondary"
                onClick={() => setDraft({ step: i })}
              >
                <span className="tape w-6 text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                <span className={i === draft.step ? "text-foreground" : "text-muted-foreground"}>{s}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="space-y-6">
          {draft.step === 0 ? (
            <Panel>
              <h2 className="font-serif text-xl">Opportunity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Observed Base market data. Source: {intel.source || "none"}.
              </p>
              {intel.error ? <p className="mt-2 text-sm text-warn">{intel.error}</p> : null}
              <div className="mt-4 max-h-[480px] overflow-auto">
                <button
                  type="button"
                  className="mb-2 flex h-11 w-full items-center justify-between rounded-md px-3 text-sm hover:bg-secondary"
                  onClick={() => setDraft({ opportunityId: null, opportunityTitle: "Unscoped composition", step: 1 })}
                >
                  <span>No opportunity — compose a blank archetype</span>
                  <span className="text-muted-foreground">Continue</span>
                </button>
                {intel.items.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="flex w-full items-start justify-between gap-3 border-t border-border px-3 py-3 text-left hover:bg-secondary"
                    onClick={() => setDraft({ opportunityId: o.id, opportunityTitle: o.title, step: 1, name: o.title })}
                  >
                    <span>
                      <span className="block text-sm">{o.title}</span>
                      <span className="text-xs text-muted-foreground">{o.protocol}</span>
                    </span>
                    <span className="tape text-sm">{o.score.toFixed(1)}</span>
                  </button>
                ))}
              </div>
            </Panel>
          ) : null}

          {draft.step === 1 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {ARCHETYPES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setArch(a.id);
                    setDraft({ step: 2 });
                  }}
                  className="rounded-2xl p-1 text-left shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_22%,transparent)]"
                >
                  <div className="rounded-xl bg-card p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-lg">{a.name}</h3>
                      {draft.archetype === a.id ? <Badge tone="ok">Selected</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{a.summary}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{a.primitives.length} primitives</p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {draft.step === 2 ? (
            <Panel>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="vname">Venture name</Label>
                  <Input
                    id="vname"
                    className="mt-2"
                    value={draft.name}
                    onChange={(e) => setDraft({ name: e.target.value })}
                    placeholder="Name the composition"
                  />
                </div>
                <div>
                  <Label>Opportunity</Label>
                  <p className="mt-3 text-sm">{draft.opportunityTitle ?? "Unscoped"}</p>
                </div>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["maxTvlUsd", "Max TVL USD"],
                    ["maxDepositUsd", "Max deposit USD"],
                    ["maxDailyOutflowUsd", "Max daily outflow USD"],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k}>
                    <Label htmlFor={k}>{label}</Label>
                    <Input
                      id={k}
                      className="mt-2"
                      type="number"
                      value={draft.composition.caps[k]}
                      onChange={(e) =>
                        setDraft({
                          composition: {
                            ...draft.composition,
                            caps: { ...draft.composition.caps, [k]: Number(e.target.value) },
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Label>Fee split (bps, residual to treasury)</Label>
                {feeError ? <p className="mt-2 text-sm text-destructive">{feeError}</p> : null}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(["protocol", "creator", "referrer", "builder", "treasury"] as const).map((k) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>{k}</span>
                        <span className="tape">{draft.composition.feeBps[k]}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={10000}
                        value={draft.composition.feeBps[k]}
                        disabled={k === "treasury"}
                        onChange={(e) => setFee(k, Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <label className="inline-flex h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.composition.pauseGuards}
                    onChange={(e) =>
                      setDraft({ composition: { ...draft.composition, pauseGuards: e.target.checked } })
                    }
                  />
                  Pause guards
                </label>
                <label className="inline-flex h-11 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.composition.circuitBreaker}
                    onChange={(e) =>
                      setDraft({ composition: { ...draft.composition, circuitBreaker: e.target.checked } })
                    }
                  />
                  Circuit breaker
                </label>
              </div>
              <div className="mt-6">
                <Button type="button" onClick={() => setDraft({ step: 3 })} disabled={Boolean(feeError)}>
                  Continue to simulation
                </Button>
              </div>
            </Panel>
          ) : null}

          {draft.step === 3 || draft.step === 4 ? (
            <div className="space-y-4">
              <Panel>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl">Economic simulation</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      BASE / BULL / BEAR / STRESS / ADVERSARIAL. Assumptions stored separately from results.
                    </p>
                  </div>
                  <Button type="button" onClick={() => void onSimulate()} disabled={busy}>
                    {busy ? "Running" : "Run simulator"}
                  </Button>
                </div>
                {sim ? (
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        <tr>
                          <th className="py-2 font-medium">Scenario</th>
                          <th className="py-2 font-medium">Gross</th>
                          <th className="py-2 font-medium">Contribution</th>
                          <th className="py-2 font-medium">Drawdown</th>
                          <th className="py-2 font-medium">Survival</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sim.map((r) => (
                          <tr key={r.scenario} className="border-t border-border">
                            <td className="py-2">{r.scenario}</td>
                            <td className="tape py-2">{usd(r.grossRevenue, 0)}</td>
                            <td className="tape py-2">{usd(r.contribution, 0)}</td>
                            <td className="tape py-2">{pct(r.maxDrawdown * 100)}</td>
                            <td className="tape py-2">{pct(r.survival * 100)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </Panel>
              {sec ? (
                <Panel>
                  <h2 className="font-serif text-xl">Sentinel findings</h2>
                  <ul className="mt-4 space-y-3">
                    {sec.map((f) => (
                      <li key={f.id} className="border-t border-border pt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={f.severity === "P0" ? "bad" : f.severity === "P1" ? "warn" : "idle"}>
                            {f.severity} · {f.status}
                          </Badge>
                          <span className="text-sm">{f.title}</span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{f.detail}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    <Button type="button" onClick={() => setDraft({ step: 5 })}>
                      Review canary path
                    </Button>
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : null}

          {draft.step === 5 ? (
            <Panel>
              <h2 className="font-serif text-xl">Canary registration</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This records the approved composition, execution evidence and canary status. Onchain publication remains a separate authorized deployment step.
              </p>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <Stat label="Archetype" value={draft.archetype} />
                <Stat label="Primitives" value={String(draft.composition.primitives.length)} />
                <Stat label="Max TVL" value={usd(draft.composition.caps.maxTvlUsd, 0)} />
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                {intel.canOperate ? (
                  <Button type="button" onClick={() => void onCompose()} disabled={busy || Boolean(feeError)}>
                    {busy ? "Registering..." : "Register canary"}
                  </Button>
                ) : (
                  <Button asChild variant="secondary">
                    <a href="/login?next=%2Ffactory">Operator sign-in required</a>
                  </Button>
                )}
                {ventureId ? (
                  <Button asChild variant="secondary">
                    <Link to="/atlas">Open Atlas</Link>
                  </Button>
                ) : null}
              </div>
              {blocked ? <p className="mt-4 text-sm text-warn">{blocked}</p> : null}
              {ventureId ? (
                <p className="tape mt-3 text-xs text-muted-foreground">venture {ventureId}</p>
              ) : null}
            </Panel>
          ) : null}

          <Panel>
            <h2 className="font-serif text-xl">Hardened primitives</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {draft.composition.primitives.length} selected for this archetype.
            </p>
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {draft.composition.primitives.map((id) => {
                const p = primitiveById(id) ?? PRIMITIVES.find((x) => x.id === id);
                if (!p) return null;
                return (
                  <li key={id} className="rounded-lg bg-secondary p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.version}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{p.summary}</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
