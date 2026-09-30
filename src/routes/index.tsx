import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRODUCTS } from "@/lib/arclenos/catalog";
import { LOOP } from "@/lib/arclenos/pipeline";
import { compactUsd, num, pct, timeAgo } from "@/lib/arclenos/format";
import { loadHome } from "@/lib/arclenos/fns";
import { bandForScore } from "@/lib/arclenos/scoring";

export const Route = createFileRoute("/")({
  loader: () => loadHome(),
  component: Home,
});

function toneFromBand(band: string): "ok" | "warn" | "bad" | "idle" {
  if (band === "HEALTHY" || band === "PRIORITY") return "ok";
  if (band === "DEGRADED" || band === "WATCH") return "warn";
  if (band === "RESTRICTED" || band === "CONTAIN" || band === "LOW") return "bad";
  return "idle";
}

function Home() {
  const data = Route.useLoaderData();
  const codePresent = data.chain?.contracts.filter((c) => c.hasCode).length ?? 0;
  const total = data.chain?.contracts.length ?? 0;

  return (
    <Shell>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
          Autonomous onchain venture infrastructure
        </p>
        <h1 className="mt-4 max-w-3xl font-serif text-4xl leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
          Discover demand. Compose the business. Operate it on Base.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          ARCLENØS identifies real economic activity, composes revenue-producing products from a hardened primitive\n          library, and operates them under explicit policy, capital limits, and verifiable execution evidence.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/factory">
              Explore Factory <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/intelligence">Discover opportunities</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/atlas">Explore Atlas</Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px bg-border sm:grid-cols-4">
          <div className="bg-background px-4 py-6 sm:px-6">
            <Stat
              label="Base"
              value={data.chain ? num(data.chain.blockNumber) : "—"}
              hint={data.chain ? `chain ${data.chain.chainId}` : "RPC unreachable this fetch"}
            />
          </div>
          <div className="bg-background px-4 py-6 sm:px-6">
            <Stat
              label="Bytecode"
              value={`${codePresent}/${total}`}
              hint="Runtime bytecode present on Base"
            />
          </div>
          <div className="bg-background px-4 py-6 sm:px-6">
            <Stat
              label="Opportunities"
              value={String(data.opportunities.length)}
              hint={data.intelError ? "Market data temporarily unavailable" : "Observed Base market data"}
            />
          </div>
          <div className="bg-background px-4 py-6 sm:px-6">
            <Stat
              label="Product surfaces"
              value={String(PRODUCTS.length)}
              hint="One governed primitive library"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Operating loop</p>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {LOOP.map((step, i) => (
            <div key={step} className="flex shrink-0 items-center gap-2">
              <span className="text-xs tracking-wide text-foreground">{step}</span>
              {i < LOOP.length - 1 ? <span className="text-muted-foreground">→</span> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Live Base demand</p>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">Scored opportunities</h2>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to="/intelligence">Open Intelligence</Link>
          </Button>
        </div>
        {data.opportunities.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              No observed opportunities this fetch.
              {data.intelError ? ` ${data.intelError}` : " No qualifying observations were returned for this refresh."}
            </p>
          </Panel>
        ) : (
          <div className="overflow-x-auto rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Opportunity</th>
                  <th className="px-4 py-3 font-medium">TVL</th>
                  <th className="px-4 py-3 font-medium">APY</th>
                  <th className="px-4 py-3 font-medium">Vol 24h</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.opportunities.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-foreground">{o.title}</div>
                      <div className="text-xs text-muted-foreground">{o.protocol}</div>
                    </td>
                    <td className="tape px-4 py-3">{compactUsd(o.tvlUsd)}</td>
                    <td className="tape px-4 py-3">{o.apy == null ? "—" : pct(o.apy)}</td>
                    <td className="tape px-4 py-3">{compactUsd(o.volumeUsd1d)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={toneFromBand(bandForScore(o.score))}>
                        {o.score.toFixed(1)} {bandForScore(o.score)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Product family</p>
        <h2 className="mt-2 font-serif text-2xl tracking-tight">One primitive library. {PRODUCTS.length} product surfaces.</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <a
              key={p.id}
              href={p.href}
              className="rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)] transition-[box-shadow] duration-150 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_22%,transparent)]"
            >
              <div className="rounded-xl bg-card p-5">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{p.kicker}</p>
                <h3 className="mt-2 font-serif text-xl tracking-tight">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.lede}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {data.chain ? (
        <section className="border-t border-border">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Live Base dependencies · {timeAgo(data.chain.fetchedAt)}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {data.chain.contracts.map((c) => (
                <div key={c.address} className="rounded-xl bg-card p-4 shadow-[0_0_0_1px_var(--color-border)]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{c.name}</span>
                    <Badge tone={c.hasCode ? "ok" : "bad"}>{c.hasCode ? "CODE PRESENT" : "UNAVAILABLE"}</Badge>
                  </div>
                  <p className="tape mt-2 truncate text-xs text-muted-foreground">{c.address}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </Shell>
  );
}
