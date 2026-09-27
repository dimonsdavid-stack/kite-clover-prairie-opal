import { BASE, COMMERCE_SKUS } from "./catalog";
import type { X402Requirement } from "./types";

export const USDC_BASE = BASE.tokens.usdc.address;

export function skuById(id: string) {
  return COMMERCE_SKUS.find((s) => s.id === id) ?? null;
}

export function usdcAtomic(usdc: string): string {
  const [w, f = ""] = usdc.split(".");
  const frac = (f + "000000").slice(0, 6);
  return `${BigInt(w) * 1_000_000n + BigInt(frac)}`;
}

export function buildX402Requirement(input: {
  skuId: string;
  payTo: string | null;
  resourceOrigin: string;
}): { requirement: X402Requirement | null; blocked: string | null; sku: (typeof COMMERCE_SKUS)[number] | null } {
  const sku = skuById(input.skuId);
  if (!sku) return { requirement: null, blocked: "Unknown SKU.", sku: null };
  if (!input.payTo) {
    return {
      sku,
      requirement: null,
      blocked:
        "Settlement BLOCKED: no founder-authorized treasury payTo. Quote economics are real; payment cannot settle until a treasury address is provided.",
    };
  }
  const resource = `${input.resourceOrigin}${sku.resource}`;
  const requirement: X402Requirement = {
    x402Version: 1,
    error: "PAYMENT_REQUIRED",
    accepts: [
      {
        scheme: "exact",
        network: "base",
        maxAmountRequired: usdcAtomic(sku.usdc),
        resource,
        description: sku.description,
        mimeType: "application/json",
        payTo: input.payTo,
        maxTimeoutSeconds: 60,
        asset: USDC_BASE,
        extra: { name: "USDC", version: "2" },
      },
    ],
  };
  return { requirement, blocked: null, sku };
}
