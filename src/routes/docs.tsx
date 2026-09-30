import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel } from "@/components/arclenos/shell";
export const Route = createFileRoute("/docs")({ component: Docs });
function Docs() {
  return <Shell kicker="ARCLENØS / Documentation" title="Build with observable primitives." lede="Machine-readable paid APIs, deployment provenance and operational evidence are separate claims.">
    <div className="mx-auto grid max-w-7xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6">
      <Panel><h2 className="font-serif text-xl">API & commerce</h2><p className="mt-2 text-sm text-muted-foreground">Service resources, request schemas, x402 challenge and receipt lifecycle.</p><Link className="mt-4 inline-block underline" to="/developers">Open developer guide →</Link></Panel>
      <Panel><h2 className="font-serif text-xl">Deployment lineage</h2><p className="mt-2 text-sm text-muted-foreground">Separate offchain review from finalized Base receipts and independently verified bytecode.</p><Link className="mt-4 inline-block underline" to="/atlas">Explore Atlas →</Link></Panel>
      <Panel><h2 className="font-serif text-xl">Economic simulations</h2><p className="mt-2 text-sm text-muted-foreground">Scenarios are assumptions, not customer yield or earned revenue.</p><Link className="mt-4 inline-block underline" to="/factory">Open Factory →</Link></Panel>
      <Panel><h2 className="font-serif text-xl">Service status</h2><p className="mt-2 text-sm text-muted-foreground">The public health API differentiates configuration, verified runtime, and live commissioning.</p><a className="mt-4 inline-block underline" href="/api/health">Read JSON health →</a></Panel>
    </div>
  </Shell>;
}
