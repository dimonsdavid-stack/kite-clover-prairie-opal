import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { loadYield } from "@/lib/arclenos/fns";
import { convertToAssets, convertToShares } from "@/lib/arclenos/economics";
import { compactUsd, pct } from "@/lib/arclenos/format";

export const Route = createFileRoute("/yield")({
  loader: () => loadYield(),
  component: YieldPage,
});

function YieldPage() {
  const data = Route.useLoaderData();
  const [assets, setAssets] = useState("1000000");
  const [totalAssets, setTotalAssets] = useState("5000000");
  const [totalSupply, setTotalSupply] = useState("5000000000");

  const math = useMemo(() => {
    try {
      const a = BigInt(assets || "0");
      const ta = BigInt(totalAssets || "0");
      const ts = BigInt(totalSupply || "0");
      const shares = convertToShares(a, ta, ts);
      const out = convertToAssets(shares, ta + a, ts + shares);
      return { shares: shares.toString(), out: out.toString(), error: null as string | null };
    } catch (e) {
      return { shares: "—", out: "—", error: e instanceof Error ? e.message : "invalid" };
    }
  }, [assets, totalAssets, totalSupply]);

  return (
    <Shell
      kicker="ARCLENØS Yield"
      title="Observed rates. Bounded vaults."
      lede="No advertised yield that has not been observed. ERC-4626 math uses a virtual offset so a donation cannot steal the next depositor."
      actions={
        <Button asChild variant="secondary">
          <Link to="/factory">Compose a vault</Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Canary TVL cap" value="$25,000" hint="Until fork evidence exists" />
          </Panel>
          <Panel>
            <Stat label="Max deposit" value="$2,500" hint="Policy vault-canary" />
          </Panel>
          <Panel>
            <Stat label="Observed pools" value={String(data.items.length)} hint="APY present in live ingest" />
          </Panel>
        </div>

        <Panel>
          <h2 className="font-serif text-xl">Share math playground</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            VIRTUAL_ASSETS = 1, VIRTUAL_SHARES = 1000. Deterministic — the LLM never overrides this.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="assets">Deposit assets</Label>
              <Input id="assets" className="mt-2" value={assets} onChange={(e) => setAssets(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ta">Total assets</Label>
              <Input id="ta" className="mt-2" value={totalAssets} onChange={(e) => setTotalAssets(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ts">Total supply</Label>
              <Input id="ts" className="mt-2" value={totalSupply} onChange={(e) => setTotalSupply(e.target.value)} />
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Stat label="Shares minted" value={math.shares} />
            <Stat label="Assets on redeem" value={math.out} hint={math.error ?? "round-trip"} />
          </div>
        </Panel>

        <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pool</th>
                <th className="px-4 py-3 font-medium">TVL</th>
                <th className="px-4 py-3 font-medium">APY</th>
                <th className="px-4 py-3 font-medium">Base APY</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div>{o.title}</div>
                    <div className="text-xs text-muted-foreground">{o.protocol}</div>
                  </td>
                  <td className="tape px-4 py-3">{compactUsd(o.tvlUsd)}</td>
                  <td className="tape px-4 py-3">{o.apy == null ? "—" : pct(o.apy)}</td>
                  <td className="tape px-4 py-3">{o.apyBase == null ? "—" : pct(o.apyBase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">
              No observed APY this fetch. Yield is not estimated from thin air.
            </p>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
