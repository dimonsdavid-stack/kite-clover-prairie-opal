import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Badge } from "@/components/ui/badge";
import { loadAtlas } from "@/lib/arclenos/fns";
import { timeAgo } from "@/lib/arclenos/format";
import { statusTone } from "@/lib/arclenos/pipeline";

export const Route = createFileRoute("/atlas")({
  loader: () => loadAtlas(),
  component: AtlasPage,
});

function AtlasPage() {
  const data = Route.useLoaderData();

  return (
    <Shell
      kicker="ARCLENØS Atlas"
      title="Provenance, not marketing."
      lede="Every composition leaves lineage, agent runs and a risk status. Mainnet addresses appear only after a real deploy."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Ventures" value={String(data.ventures.length)} />
          </Panel>
          <Panel>
            <Stat label="Agent runs" value={String(data.runs.length)} />
          </Panel>
          <Panel>
            <Stat label="Base block" value={data.chain ? String(data.chain.blockNumber) : "—"} />
          </Panel>
        </div>

        <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Venture</th>
                <th className="px-4 py-3 font-medium">Archetype</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Risk</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.ventures.map((v) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link to="/atlas/$id" params={{ id: v.id }} className="hover:underline">
                      {v.name}
                    </Link>
                    <div className="tape text-xs text-muted-foreground">{v.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-4 py-3">{v.archetype}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                  </td>
                  <td className="px-4 py-3">{v.riskStatus}</td>
                  <td className="tape px-4 py-3">{timeAgo(v.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.ventures.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              Atlas is empty until Factory registers a canary. No sample ventures are injected.
            </p>
          ) : null}
        </div>

        <Panel>
          <h2 className="font-serif text-xl">Recent agent evidence</h2>
          <ul className="mt-4 space-y-3">
            {data.runs.slice(0, 12).map((r) => (
              <li key={r.id} className="border-t border-border pt-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{r.agent}</span>
                  {r.to ? <Badge tone="idle">{r.to}</Badge> : null}
                  <span className="tape text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{r.reason}</p>
              </li>
            ))}
            {data.runs.length === 0 ? <li className="text-sm text-muted-foreground">No runs yet.</li> : null}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}
