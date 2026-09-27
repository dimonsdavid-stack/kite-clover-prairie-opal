import { BASE } from "./catalog";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

function provider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: EthereumProvider }).ethereum;
  return eth ?? null;
}

export function hasInjectedWallet() {
  return provider() != null;
}

export async function connectWallet(): Promise<{ address: string; chainId: number }> {
  const eth = provider();
  if (!eth) throw new Error("No injected wallet. Install a Base-capable wallet to continue.");
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
  const address = accounts[0];
  if (!address) throw new Error("Wallet returned no account.");
  const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
  const chainId = Number.parseInt(chainHex, 16);
  return { address, chainId };
}

export async function switchToBase() {
  const eth = provider();
  if (!eth) throw new Error("No injected wallet.");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x2105" }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0x2105",
            chainName: "Base",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [...BASE.rpcs],
            blockExplorerUrls: [BASE.explorer],
          },
        ],
      });
      return;
    }
    throw err;
  }
}

export function subscribeWallet(handlers: {
  accounts?: (accounts: string[]) => void;
  chain?: (chainId: number) => void;
}) {
  const eth = provider();
  if (!eth?.on) return () => {};
  const onAccounts = (...args: unknown[]) => handlers.accounts?.(args[0] as string[]);
  const onChain = (...args: unknown[]) => handlers.chain?.(Number.parseInt(String(args[0]), 16));
  eth.on("accountsChanged", onAccounts);
  eth.on("chainChanged", onChain);
  return () => {
    eth.removeListener?.("accountsChanged", onAccounts);
    eth.removeListener?.("chainChanged", onChain);
  };
}
