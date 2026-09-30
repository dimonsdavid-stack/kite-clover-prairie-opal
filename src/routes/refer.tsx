import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell, Panel } from "@/components/arclenos/shell";
export const Route = createFileRoute("/refer")({ component: Refer });
function Refer() {
  return <Shell kicker="ARCLENØS / Network" title="Distribution tied to verifiable outcomes." lede="Referral attribution measures qualified actions and settled economic events. A tracked click is not a paid conversion.">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><Panel>
      <h2 className="font-serif text-xl">Referral status</h2>
      <p className="mt-3 text-sm text-muted-foreground">The attribution ledger and quality controls are under development. No referral payout is promised or owed through this page.</p>
      <Link to="/commerce" className="mt-5 inline-flex rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Explore services →</Link>
    </Panel></div>
  </Shell>;
}
