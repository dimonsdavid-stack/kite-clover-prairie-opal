import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell, Panel, Stat } from "@/components/arclenos/shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadCommerce } from "@/lib/arclenos/fns";
import { usd } from "@/lib/arclenos/format";
import { useArclenos } from "@/lib/arclenos/store";
import {
  connectWallet,
  decodePaymentRequiredHeader,
  selectBaseUsdcRequirement,
  signX402Requirement,
  usdcAtomic,
} from "@/lib/arclenos/wallet";
import { BASE } from "@/lib/arclenos/catalog";

export const Route = createFileRoute("/commerce")({
  loader: () => loadCommerce(),
  component: CommercePage,
});

const composition = {
  archetype: "x402-commerce",
  primitives: ["factory", "lineage-registry", "x402-adapter"],
  feeBps: { protocol: 2000, creator: 3000, referrer: 1000, builder: 1000, treasury: 3000 },
  caps: { maxTvlUsd: 25000, maxDepositUsd: 2500, maxDailyOutflowUsd: 1000 },
  pauseGuards: true,
  circuitBreaker: true,
};

async function responseBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return { error: "INVALID_SERVER_RESPONSE" };
  }
}

function CommercePage() {
  const data = Route.useLoaderData();
  const address = useArclenos((s) => s.address);
  const chainId = useArclenos((s) => s.chainId);
  const setWallet = useArclenos((s) => s.setWallet);
  const [active, setActive] = useState<string>(data.skus[1]?.id ?? "sim.stress");
  const [body, setBody] = useState(JSON.stringify({ composition }, null, 2));
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const sku = data.skus.find((s) => s.id === active);

  function select(id: string) {
    setActive(id);
    setStatus(null);
    setResult("");
    setBody(JSON.stringify(id === "intel.opportunity" ? { opportunityId: "" } : { composition }, null, 2));
  }

  function parseRequestBody() {
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new Error("Request JSON is invalid.");
    }
  }

  async function ensureWallet() {
    let currentAddress = address;
    if (!currentAddress) {
      const connected = await connectWallet();
      currentAddress = connected.address;
      setWallet(connected.address, connected.chainId);
    }
    return currentAddress;
  }

  async function payAndRun() {
    if (!sku) return;
    setBusy(true);
    setStatus(null);
    try {
      const requestBody = parseRequestBody();
      const payer = await ensureWallet();

      const challengeResponse = await fetch(sku.resource, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const challengeBody = await responseBody(challengeResponse);
      setStatus(challengeResponse.status);

      if (challengeResponse.status !== 402) {
        setResult(JSON.stringify({
          status: challengeResponse.status,
          body: challengeBody,
          note: challengeResponse.status === 503
            ? "Commerce is not commissioned yet; no wallet authorization was signed and no payment was submitted."
            : "The server did not request payment.",
        }, null, 2));
        return;
      }

      const paymentRequired = challengeResponse.headers.get("PAYMENT-REQUIRED");
      if (!paymentRequired) {
        throw new Error("Payment-required response is missing the x402 challenge header.");
      }

      const challenge = decodePaymentRequiredHeader(paymentRequired);
      const requirement = selectBaseUsdcRequirement(challenge, usdcAtomic(sku.usdc));
      setResult(JSON.stringify({
        status: 402,
        stage: "AWAITING_WALLET_SIGNATURE",
        network: requirement.network,
        asset: "Base USDC",
        amount: sku.usdc,
        payTo: requirement.payTo,
        expiresWithinSeconds: Math.min(requirement.maxTimeoutSeconds, 300),
      }, null, 2));

      const paymentSignature = await signX402Requirement(challenge, requirement, payer);
      const paidResponse = await fetch(sku.resource, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "PAYMENT-SIGNATURE": paymentSignature,
        },
        body: JSON.stringify(requestBody),
      });
      const paidBody = await responseBody(paidResponse);
      setStatus(paidResponse.status);
      setResult(JSON.stringify({
        status: paidResponse.status,
        paymentResponse: paidResponse.headers.get("PAYMENT-RESPONSE"),
        body: paidBody,
        note: paidResponse.status === 200
          ? "Payment settled and the purchased result was returned."
          : paidResponse.status === 409 || paidResponse.status === 503
            ? "Do not sign a second payment for the same request while reconciliation is pending."
            : undefined,
      }, null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Payment request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      kicker="ARCLENØS Commerce"
      title="Buy a useful API response."
      lede="Base USDC payments for deterministic opportunity analysis, economic simulation and configuration review. The wallet signs an exact, short-lived x402 authorization; ARCLENØS settles only the displayed amount."
    >
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Panel>
            <Stat label="Services" value={String(data.skus.length)} hint="x402 v2 · Base USDC" />
          </Panel>
          <Panel>
            <Stat
              label="Treasury recipient"
              value={data.treasurySet ? "configured" : "unset"}
              hint={data.commerceConfigured ? "Settlement rail configured" : "Checkout disabled until settlement configuration is complete"}
            />
          </Panel>
          <Panel>
            <Stat
              label="Settled customer revenue"
              value={usd(data.revenue.reduce((a, r) => a + r.amountUsd, 0), 2)}
              hint={String(data.revenue.length) + " verified economic events"}
            />
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            {data.skus.map((s) => (
              <Panel key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-serif text-lg">{s.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                    <p className="tape mt-2 break-all text-xs text-muted-foreground">
                      POST {s.resource}
                    </p>
                  </div>
                  <Badge tone={s.id === active ? "ok" : "idle"}>
                    {s.usdc} USDC
                  </Badge>
                </div>
                <Button
                  className="mt-4 min-h-11"
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => select(s.id)}
                >
                  Select {s.name.toLowerCase()}
                </Button>
              </Panel>
            ))}
            <Panel>
              <p className="text-sm text-muted-foreground">
                Wallet checkout uses EIP-3009 TransferWithAuthorization on native Base USDC. It signs only the exact displayed amount and a one-time nonce; it does not grant an unlimited token allowance. Internal transfers are excluded from customer revenue.
              </p>
              <a className="mt-3 inline-block underline" href="/developers">
                Developer integration
              </a>
            </Panel>
          </div>

          <Panel>
            <h2 className="font-serif text-xl">{sku?.name} request</h2>
            <label className="mt-4 block text-sm" htmlFor="commerce-body">
              Request JSON
            </label>
            <textarea
              id="commerce-body"
              className="mt-2 min-h-64 w-full rounded-md border border-border bg-background p-3 font-mono text-xs"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={busy}
            />

            <div className="mt-4 flex flex-wrap gap-3">
              <Button disabled={busy || !sku || !data.commerceConfigured} onClick={() => void payAndRun()}>
                {busy
                  ? "Processing..."
                  : data.commerceConfigured
                    ? "Pay with wallet · $" + (sku?.usdc ?? "-") + " USDC"
                    : "Checkout unavailable"}
              </Button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {address
                ? "Wallet " +
                  address.slice(0, 6) +
                  "..." +
                  address.slice(-4) +
                  " · " +
                  (chainId === BASE.chainId ? "Base" : "network switch required")
                : "Connect a Base-capable browser wallet when prompted. Never enter a private key or seed phrase."}
            </p>

            <div className="mt-6" role="status" aria-live="polite">
              <h3 className="text-sm font-medium">
                {status ? "HTTP " + status : "Response"}
              </h3>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-all text-xs leading-relaxed text-muted-foreground">
                {result ||
                  (data.commerceConfigured
                    ? "Select a service and pay directly with your wallet."
                    : "Checkout is disabled until production settlement configuration is complete.")}
              </pre>
            </div>
          </Panel>
        </div>
      </div>
    </Shell>
  );
}
