import { createFileRoute } from "@tanstack/react-router";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Badge } from "@/components/ui/badge";
import { loadLiquidity } from "@/lib/arclenos/fns";
import { compactUsd, shortAddr } from "@/lib/arclenos/format";
import { BASE } from "@/lib/arclenos/catalog";

export const Route = createFileRoute("/liquidity")({
  loader: () => loadLiquidity(),
  component: LiquidityPage,
});

function LiquidityPage() {
  const data = Route.useLoaderData();
  const codePresent = data.chain?.contracts.filter((c) => c.hasCode).length ?? 0;

  return (
    <Shell
      kicker="ARCLENØS Liquidity"
      title="Onchain venues. Live pairs."
      lede="Base venue addresses are checked for deployed runtime code at request time. Pair data is sourced live from Dexscreener; code presence is not presented as a codehash audit."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Runtime bytecode" value={`${codePresent}/${data.chain?.contracts.length ?? 0}`} hint="Live eth_getCode presence" />
          </Panel>
          <Panel>
            <Stat label="WETH pairs" value={String(data.pairs.length)} hint="Dexscreener, Base only" />
          </Panel>
          <Panel>
            <Stat label="Router" value={shortAddr(BASE.aerodrome.router)} hint="Aerodrome" />
          </Panel>
        </div>
        {data.error ? <p className="text-sm text-warn">{data.error}</p> : null}

        {data.chain ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.chain.contracts.map((c) => (
              <div key={c.address} className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_var(--color-border)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{c.name}</span>
                  <Badge tone={c.hasCode ? "ok" : "bad"}>{c.hasCode ? "CODE PRESENT" : "NO CODE"}</Badge>
                </div>
                <p className="tape mt-2 truncate text-xs text-muted-foreground">{c.address}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Pair</th>
                <th className="px-4 py-3 font-medium">DEX</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Liquidity</th>
                <th className="px-4 py-3 font-medium">Vol 24h</th>
              </tr>
            </thead>
            <tbody>
              {data.pairs.map((p) => (
                <tr key={p.pairAddress} className="border-t border-border">
                  <td className="px-4 py-3">
                    {p.baseToken.symbol}/{p.quoteToken.symbol}
                    <div className="tape text-xs text-muted-foreground">{shortAddr(p.pairAddress)}</div>
                  </td>
                  <td className="px-4 py-3">{p.dexId}</td>
                  <td className="tape px-4 py-3">{p.priceUsd ? `$${p.priceUsd}` : "—"}</td>
                  <td className="tape px-4 py-3">{compactUsd(p.liquidityUsd)}</td>
                  <td className="tape px-4 py-3">{compactUsd(p.volume24h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.pairs.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">No Base pairs returned this fetch.</p>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
