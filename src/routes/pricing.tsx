import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel } from "@/components/arclenos/shell";
import { COMMERCE_SKUS } from "@/lib/arclenos/catalog";
export const Route = createFileRoute("/pricing")({ component: PricingPage });
function PricingPage() {
  return <Shell kicker="ARCLENØS / Commercial access" title="Usage-based services on Base." lede="Per-request pricing in Base USDC with deterministic request formats and verifiable settlement receipts.">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="grid gap-4 md:grid-cols-2">{COMMERCE_SKUS.map(s => <Panel key={s.id}>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s.id}</p>
        <h2 className="mt-3 font-serif text-2xl">{s.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
        <p className="mt-4 font-serif text-3xl">${s.usdc} <span className="text-sm text-muted-foreground">USDC / request</span></p>
        <p className="mt-2 font-mono text-xs text-muted-foreground">{s.resource}</p>
        <Link className="mt-4 inline-flex rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary" to="/commerce">View service details →</Link>
      </Panel>)}</div>
      <p className="mt-8 text-sm text-muted-foreground">API schemas, request formats and settlement requirements are available in the <Link className="underline" to="/developers">developer documentation</Link>.</p>
    </div>
  </Shell>;
}
