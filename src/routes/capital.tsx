import { createFileRoute } from "@tanstack/react-router";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Badge } from "@/components/ui/badge";
import { loadCapital } from "@/lib/arclenos/fns";
import { usd } from "@/lib/arclenos/format";

export const Route = createFileRoute("/capital")({
  loader: () => loadCapital(),
  component: CapitalPage,
});

function CapitalPage() {
  const data = Route.useLoaderData();
  const realized = data.revenue.reduce((a, r) => a + r.amountUsd, 0);

  return (
    <Shell
      kicker="ARCLENØS Capital"
      title="ALLOW / DENY / CAP / PAUSE."
      lede="Treasury actions are policy-gated, capped and approval-bound. Missing balances are NOT APPLICABLE, not zero."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Treasury" value={data.treasury ? "configured" : "unset"} hint={data.note} />
          </Panel>
          <Panel>
            <Stat label="Verification" value={data.verification} />
          </Panel>
          <Panel>
            <Stat label="Realized revenue" value={usd(realized, 2)} hint="On-record consideration only" />
          </Panel>
        </div>
        <Panel>
          <h2 className="font-serif text-xl">Policies</h2>
          <ul className="mt-4 space-y-3">
            {data.policies.map((p) => (
              <li key={p.id} className="border-t border-border pt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.action === "DENY" || p.action === "PAUSE" ? "warn" : "idle"}>{p.action}</Badge>
                  <span className="text-sm">{p.resource}</span>
                  {p.capUsd != null ? <span className="tape text-xs text-muted-foreground">cap {usd(p.capUsd, 0)}</span> : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{p.reason}</p>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <h2 className="font-serif text-xl">Execution authority</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Control</th>
                  <th className="py-2 font-medium">Mandate</th>
                  <th className="py-2 font-medium">Authority</th>
                </tr>
              </thead>
              <tbody>
                {data.agents.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-muted-foreground">{a.mandate}</td>
                    <td className="py-2">{a.authority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </Shell>
  );
}
