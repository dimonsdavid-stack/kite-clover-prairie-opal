import { createFileRoute } from "@tanstack/react-router";
import { Shell, Panel } from "@/components/arclenos/shell";
export const Route = createFileRoute("/guardstate")({ component: GuardState });
function GuardState() {
  return <Shell kicker="ARCLENØS / Separate product" title="GuardState" lede="The institutional control plane for agentic finance is a separate product and is not the ARCLENØS venture factory.">
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><Panel>
      <p className="text-sm text-muted-foreground">Agents decide. Policies govern. Venues execute. GuardState proves what happened.</p>
      <a href="https://guardstate.vercel.app/" target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Visit GuardState ↗</a>
    </Panel></div>
  </Shell>;
}
