import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { PRODUCTS } from "@/lib/arclenos/catalog";
import { cn } from "@/lib/utils";
import { Mark } from "./mark";
import { WalletButton } from "./wallet-button";
import { Button } from "@/components/ui/button";

const PRIMARY = [
  { href: "/factory" as const, label: "Factory" },
  { href: "/intelligence" as const, label: "Intelligence" },
  { href: "/atlas" as const, label: "Atlas" },
  { href: "/commerce" as const, label: "Commerce" },
  { href: "/developers" as const, label: "API" },
];

export function Shell({
  children,
  kicker,
  title,
  lede,
  actions,
}: {
  children: React.ReactNode;
  kicker?: string;
  title?: string;
  lede?: string;
  actions?: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <Mark className="size-7" />
            <span className="font-serif text-lg tracking-tight">ARCLENØS</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 overflow-x-auto lg:flex">
            {PRIMARY.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className={cn(
                  "inline-flex h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground",
                  pathname === l.href && "text-foreground",
                )}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/operations"
              className={cn(
                "inline-flex h-11 items-center px-3 text-sm text-muted-foreground hover:text-foreground",
                pathname === "/operations" && "text-foreground",
              )}
            >
              Operations
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <WalletButton />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
        {open ? (
          <div className="border-t border-border px-4 py-3 lg:hidden">
            <div className="grid grid-cols-2 gap-1">
              {PRODUCTS.map((p) => (
                <a
                  key={p.id}
                  href={p.href}
                  className="inline-flex h-11 items-center px-2 text-sm text-muted-foreground"
                  onClick={() => setOpen(false)}
                >
                  {p.name}
                </a>
              ))}
              <Link to="/pricing" className="inline-flex h-11 items-center px-2 text-sm" onClick={() => setOpen(false)}>
                Pricing
              </Link>
              <Link to="/docs" className="inline-flex h-11 items-center px-2 text-sm" onClick={() => setOpen(false)}>
                Docs
              </Link>
              <Link to="/operations" className="inline-flex h-11 items-center px-2 text-sm" onClick={() => setOpen(false)}>
                Operations
              </Link>
              <Link to="/refer" className="inline-flex h-11 items-center px-2 text-sm" onClick={() => setOpen(false)}>
                Refer
              </Link>
            </div>
          </div>
        ) : null}
      </header>
      {title ? (
        <div className="border-b border-border">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              {kicker ? (
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{kicker}</p>
              ) : null}
              <h1 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">{title}</h1>
              {lede ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{lede}</p> : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      ) : null}
      <main>{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Mark className="size-5" />
              <span className="font-serif">ARCLENØS</span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Autonomous onchain venture infrastructure on Base, from observed demand to governed deployment and verifiable operations.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-sm text-muted-foreground sm:grid-cols-3">
            {PRODUCTS.map((p) => (
              <a key={p.id} href={p.href} className="inline-flex h-9 items-center hover:text-foreground">
                {p.name}
              </a>
            ))}
            <Link to="/pricing" className="inline-flex h-9 items-center hover:text-foreground">
              Pricing
            </Link>
            <Link to="/docs" className="inline-flex h-9 items-center hover:text-foreground">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl p-1 shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_10%,transparent)]",
        className,
      )}
    >
      <div className="rounded-xl bg-card p-5">{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="tape mt-1 font-serif text-2xl tracking-tight">{value}</div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
