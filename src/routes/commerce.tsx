import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { attemptSku, loadCommerce, quoteSku } from "@/lib/arclenos/fns";
import { usd } from "@/lib/arclenos/format";

export const Route = createFileRoute("/commerce")({
  loader: () => loadCommerce(),
  component: CommercePage,
});

function CommercePage() {
  const data = Route.useLoaderData();
  const [active, setActive] = useState<string | null>(null);
  const [payload, setPayload] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function quote(id: string) {
    setBusy(true);
    try {
      const q = await quoteSku({ data: { skuId: id } });
      setActive(id);
      setPayload(JSON.stringify(q, null, 2));
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    try {
      const r = await attemptSku({ data: { skuId: id, payment: null } });
      setActive(id);
      setPayload(JSON.stringify(r, null, 2));
      toast.message(r.status === "PAYMENT_REQUIRED" ? "402 Payment Required" : r.status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="ARCLENØS Commerce"
      title="Paid machine APIs. Real 402s."
      lede="Request → requirement → payment → verification → settlement → receipt. Settlement is never faked. Without a founder treasury payTo, quotes still emit; capture stays BLOCKED."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="SKUs" value={String(data.skus.length)} hint="USDC on Base" />
          </Panel>
          <Panel>
            <Stat
              label="Treasury payTo"
              value={data.treasurySet ? "configured" : "unset"}
              hint={data.treasurySet ? "Facilitator still required" : "Settlement BLOCKED"}
            />
          </Panel>
          <Panel>
            <Stat
              label="Recorded revenue"
              value={usd(data.revenue.reduce((a, r) => a + r.amountUsd, 0), 2)}
              hint={data.revenue.length ? `${data.revenue.length} events` : "none — not invented"}
            />
          </Panel>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {data.skus.map((s) => (
              <Panel key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-lg">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    <p className="tape mt-2 text-xs text-muted-foreground">{s.resource}</p>
                  </div>
                  <Badge tone="idle">${s.usdc} USDC</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void quote(s.id)}>
                    Quote x402
                  </Button>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void settle(s.id)}>
                    Call without payment
                  </Button>
                </div>
              </Panel>
            ))}
          </div>
          <Panel>
            <h2 className="font-serif text-xl">{active ?? "Requirement"}</h2>
            <pre className="mt-4 overflow-x-auto text-xs leading-relaxed text-muted-foreground">
              {payload || "Quote a SKU to inspect the machine-readable requirement."}
            </pre>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
