import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { loadOperations } from "@/lib/arclenos/fns";

export const Route = createFileRoute("/operations")({
  loader: () => loadOperations(),
  component: Operations,
});

function Operations() {
  const data = Route.useLoaderData();

  if (!data.authorized) {
    return (
      <Shell
        kicker="ARCLENØS / Restricted console"
        title="Operator authorization required."
        lede="Operations and incident evidence are restricted. Public product surfaces remain available without exposing privileged control-plane data."
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <Panel>
            <p className="text-sm text-muted-foreground">{data.reason}</p>
            <Link to="/login" search={{ next: "/operations" }} className="mt-4 inline-flex h-11 items-center text-sm underline">
              Sign in to Operations
            </Link>
          </Panel>
        </div>
      </Shell>
    );
  }

  return (
    <Shell
      kicker="ARCLENØS / Restricted console"
      title="Operations and incident evidence."
      lede="Operator authorization required. The control plane displays observed state, not fabricated deployment or payment status."
    >
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Panel><Stat label="Overall observed health" value={String(data.health.overall)} hint={data.health.band} /></Panel>
          <Panel><Stat label="Recorded ventures" value={String(data.ventures.length)} /></Panel>
          <Panel><Stat label="Revenue records" value={String(data.revenue.length)} hint="Economic validity must be independently reconciled" /></Panel>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.health.components.map((c) => (
            <Panel key={c.id}>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</div>
              <div className="mt-2 font-serif text-xl">{c.band} · {c.score}</div>
              <p className="mt-2 text-sm text-muted-foreground">{c.detail}</p>
            </Panel>
          ))}
        </div>
      </div>
    </Shell>
  );
}
