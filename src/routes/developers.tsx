import { createFileRoute } from "@tanstack/react-router";
import { Shell, Panel } from "@/components/arclenos/shell";
import { COMMERCE_SKUS } from "@/lib/arclenos/catalog";

export const Route = createFileRoute("/developers")({
  component: DevelopersPage,
});

const ENDPOINTS = [
  { method: "GET", path: "/api/health", note: "Component health scores, chain id, block." },
  { method: "GET", path: "/api/v1/opportunities", note: "Observed Base opportunities with factor scores." },
  { method: "GET", path: "/api/v1/atlas", note: "Ventures, lineage summary, statuses." },
  { method: "GET", path: "/api/v1/pricing", note: "Machine-readable SKU list." },
  { method: "POST", path: "/api/v1/intelligence/opportunity", note: "x402. 402 unless treasury + payment." },
  { method: "POST", path: "/api/v1/simulate", note: "x402. Stress pack for a composition." },
  { method: "POST", path: "/api/v1/security/review", note: "x402. Deterministic invariant scan." },
  { method: "POST", path: "/api/v1/factory/preview", note: "x402. Calldata / lineage draft." },
];

function DevelopersPage() {
  return (
    <Shell
      kicker="ARCLENØS API"
      title="Idempotent, priced, receipted."
      lede="Machine-readable pricing, exact payment requirements, idempotent retries and verifiable receipts."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <Panel>
          <h2 className="font-serif text-xl">Quickstart</h2>
          <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-muted-foreground">{`curl -s https://arclenos.com/api/health
curl -s https://arclenos.com/api/v1/opportunities
curl -s https://arclenos.com/api/v1/pricing
curl -s -X POST https://arclenos.com/api/v1/intelligence/opportunity \\
  -H 'content-type: application/json' \\
  -d '{"opportunityId":"<id from /api/v1/opportunities>"}'
# → 402 Payment Required when checkout is commissioned
# → 503 COMMERCE_NOT_COMMISSIONED until settlement configuration is complete`}</pre>
        </Panel>
        <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Path</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-t border-border">
                  <td className="tape px-4 py-3">{e.method}</td>
                  <td className="px-4 py-3">{e.path}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Panel>
          <h2 className="font-serif text-xl">SKUs</h2>
          <ul className="mt-4 space-y-3 text-sm">
            {COMMERCE_SKUS.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 border-t border-border pt-3">
                <span>
                  {s.name}
                  <span className="block text-xs text-muted-foreground">{s.resource}</span>
                </span>
                <span className="tape">${s.usdc}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}
