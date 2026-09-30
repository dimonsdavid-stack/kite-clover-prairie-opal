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


export type X402Requirement = {
  scheme: "exact";
  network: "eip155:8453";
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: Record<string, unknown>;
};

export type X402Challenge = {
  x402Version: 2;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: X402Requirement[];
};

function encodeBase64Json(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodePaymentRequiredHeader(header: string): X402Challenge {
  try {
    const binary = atob(header);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as X402Challenge;
    if (parsed.x402Version !== 2 || !Array.isArray(parsed.accepts)) throw new Error("Unsupported x402 challenge.");
    return parsed;
  } catch {
    throw new Error("The server returned an invalid x402 payment requirement.");
  }
}

export function usdcAtomic(amount: string) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(amount)) throw new Error("Invalid USDC price.");
  const [whole, fraction = ""] = amount.split(".");
  return (BigInt(whole) * 1_000_000n + BigInt((fraction + "000000").slice(0, 6))).toString();
}

export function selectBaseUsdcRequirement(challenge: X402Challenge, expectedAmount: string): X402Requirement {
  const requirement = challenge.accepts.find((item) =>
    item?.scheme === "exact" &&
    item?.network === "eip155:8453" &&
    typeof item.asset === "string" &&
    item.asset.toLowerCase() === BASE.tokens.usdc.address.toLowerCase() &&
    item.amount === expectedAmount,
  );
  if (!requirement) throw new Error("No matching Base USDC payment requirement was returned.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(requirement.payTo) || /^0x0{40}$/i.test(requirement.payTo)) {
    throw new Error("The payment requirement contains an invalid treasury address.");
  }
  if (!Number.isInteger(requirement.maxTimeoutSeconds) || requirement.maxTimeoutSeconds <= 0 || requirement.maxTimeoutSeconds > 900) {
    throw new Error("The payment requirement contains an unsafe validity window.");
  }
  return requirement;
}

export async function signX402Requirement(
  challenge: X402Challenge,
  requirement: X402Requirement,
  from: string,
): Promise<string> {
  const eth = provider();
  if (!eth) throw new Error("No injected wallet. Install a Base-capable wallet to continue.");
  if (!/^0x[0-9a-fA-F]{40}$/.test(from)) throw new Error("Invalid payer address.");

  await switchToBase();

  const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
  const active = accounts[0];
  if (!active || active.toLowerCase() !== from.toLowerCase()) {
    throw new Error("The active wallet account changed. Reconnect the wallet and try again.");
  }
  const chainHex = (await eth.request({ method: "eth_chainId" })) as string;
  if (Number.parseInt(chainHex, 16) !== BASE.chainId) throw new Error("Wallet is not connected to Base.");

  const now = Math.floor(Date.now() / 1000);
  const timeout = Math.min(requirement.maxTimeoutSeconds, 300);
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = `0x${Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

  const authorization = {
    from,
    to: requirement.payTo,
    value: requirement.amount,
    validAfter: String(Math.max(0, now - 10)),
    validBefore: String(now + timeout),
    nonce,
  };

  const domainName = typeof requirement.extra?.name === "string" ? requirement.extra.name : "USD Coin";
  const domainVersion = typeof requirement.extra?.version === "string" ? requirement.extra.version : "2";
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    domain: {
      name: domainName,
      version: domainVersion,
      chainId: BASE.chainId,
      verifyingContract: requirement.asset,
    },
    message: authorization,
  };

  const signature = await eth.request({
    method: "eth_signTypedData_v4",
    params: [from, JSON.stringify(typedData)],
  });
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw new Error("Wallet returned an invalid EIP-3009 signature.");
  }

  return encodeBase64Json({
    x402Version: 2,
    ...(challenge.resource?.url ? { resource: { url: challenge.resource.url } } : {}),
    accepted: requirement,
    payload: { signature, authorization },
  });
}
