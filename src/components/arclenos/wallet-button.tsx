import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useArclenos } from "@/lib/arclenos/store";
import { connectWallet, hasInjectedWallet, subscribeWallet, switchToBase } from "@/lib/arclenos/wallet";
import { shortAddr } from "@/lib/arclenos/format";
import { CHAIN_ID_BASE } from "@/lib/arclenos/types";
import { trackFunnel } from "@/lib/arclenos/fns";

export function WalletButton() {
  const address = useArclenos((s) => s.address);
  const chainId = useArclenos((s) => s.chainId);
  const setWallet = useArclenos((s) => s.setWallet);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const injected = typeof window !== "undefined" && hasInjectedWallet();

  useEffect(() => {
    return subscribeWallet({
      accounts: (accounts) => setWallet(accounts[0] ?? null, useArclenos.getState().chainId),
      chain: (id) => setWallet(useArclenos.getState().address, id),
    });
  }, [setWallet]);

  async function onConnect() {
    setBusy(true);
    setErr(null);
    try {
      const w = await connectWallet();
      setWallet(w.address, w.chainId);
      void trackFunnel({ data: { name: "wallet", path: window.location.pathname } });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Wallet refused.");
    } finally {
      setBusy(false);
    }
  }

  if (address) {
    const wrong = chainId != null && chainId !== CHAIN_ID_BASE;
    return (
      <div className="flex items-center gap-2">
        {wrong ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => void switchToBase()}>
            Switch to Base
          </Button>
        ) : null}
        <span className="tape hidden h-11 items-center rounded-md px-3 text-xs text-muted-foreground shadow-[0_0_0_1px_var(--color-border)] sm:inline-flex">
          {shortAddr(address)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void onConnect()}>
        {busy ? "Connecting" : injected ? "Connect wallet" : "No wallet"}
      </Button>
      {err ? <span className="mt-1 max-w-40 text-right text-[10px] text-destructive">{err}</span> : null}
    </div>
  );
}
