import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Badge } from "@/components/ui/badge";
import { loadVenture } from "@/lib/arclenos/fns";
import { timeAgo, usd, pct } from "@/lib/arclenos/format";
import { statusTone } from "@/lib/arclenos/pipeline";
import { AGENTS, primitiveById } from "@/lib/arclenos/catalog";

export const Route = createFileRoute("/atlas/$id")({
  loader: ({ params }) => loadVenture({ data: { id: params.id } }),
  component: VenturePage,
});

function VenturePage() {
  const { venture, runs } = Route.useLoaderData();
  if (!venture) {
    return (
      <Shell kicker="Atlas" title="Not found" lede="No venture with that identifier.">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <Link to="/atlas" className="text-sm underline">
            Back to Atlas
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      kicker="Atlas lineage"
      title={venture.name}
      lede={`${venture.archetype} · created ${timeAgo(venture.createdAt)}`}
      actions={
        <Badge tone={statusTone(venture.status)}>{venture.status}</Badge>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Risk" value={venture.riskStatus} />
          </Panel>
          <Panel>
            <Stat label="Primitives" value={String(venture.composition?.primitives.length ?? 0)} />
          </Panel>
          <Panel>
            <Stat label="Created by" value={venture.lineage.createdBy === "agent" ? "automation" : venture.lineage.createdBy} />
          </Panel>
        </div>
        {venture.simulation ? (
          <Panel>
            <h2 className="font-serif text-xl">Simulation</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Scenario</th>
                    <th className="py-2 font-medium">Contribution</th>
                    <th className="py-2 font-medium">Drawdown</th>
                    <th className="py-2 font-medium">Survival</th>
                  </tr>
                </thead>
                <tbody>
                  {venture.simulation.map((r) => (
                    <tr key={r.scenario} className="border-t border-border">
                      <td className="py-2">{r.scenario}</td>
                      <td className="tape py-2">{usd(r.contribution, 0)}</td>
                      <td className="tape py-2">{pct(r.maxDrawdown * 100)}</td>
                      <td className="tape py-2">{pct(r.survival * 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : null}
        {venture.security ? (
          <Panel>
            <h2 className="font-serif text-xl">Security</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {venture.security.map((f) => (
                <li key={f.id} className="border-t border-border pt-2">
                  <Badge tone={f.severity === "P0" ? "bad" : f.severity === "P1" ? "warn" : "idle"}>
                    {f.severity}
                  </Badge>{" "}
                  {f.title}
                  <p className="mt-1 text-muted-foreground">{f.detail}</p>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
        <Panel>
          <h2 className="font-serif text-xl">Lineage</h2>
          <pre className="mt-4 overflow-x-auto text-xs text-muted-foreground">
            {JSON.stringify({
              lineage: {
                ...venture.lineage,
                createdBy: venture.lineage.createdBy === "agent" ? "automation" : venture.lineage.createdBy,
              },
              composition: venture.composition
                ? {
                    ...venture.composition,
                    primitives: venture.composition.primitives.map((id) => primitiveById(id)?.name ?? id),
                  }
                : venture.composition,
              config: venture.config,
            }, null, 2)}
          </pre>
        </Panel>
        <Panel>
          <h2 className="font-serif text-xl">Execution log</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="border-t border-border pt-3">
                <span className="text-foreground">{AGENTS.find((control) => control.id === r.agent)?.name ?? "Execution control"}</span>
                {r.from ? <span className="text-muted-foreground"> {r.from} → {r.to}</span> : null}
                <p className="mt-1 text-muted-foreground">{r.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}
