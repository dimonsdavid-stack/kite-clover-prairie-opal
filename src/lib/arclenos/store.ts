import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Archetype, Composition, VentureStatus } from "./types";
import { ARCHETYPES } from "./catalog";

export type FactoryDraft = {
  step: number;
  opportunityId: string | null;
  opportunityTitle: string | null;
  archetype: Archetype;
  name: string;
  composition: Composition;
  status: VentureStatus | null;
  ventureId: string | null;
};

const defaultArch = ARCHETYPES[0];

export const defaultDraft = (): FactoryDraft => ({
  step: 0,
  opportunityId: null,
  opportunityTitle: null,
  archetype: defaultArch.id,
  name: "",
  composition: {
    archetype: defaultArch.id,
    primitives: defaultArch.primitives,
    feeBps: { ...defaultArch.defaultFees },
    caps: { maxTvlUsd: 25_000, maxDepositUsd: 2_500, maxDailyOutflowUsd: 5_000 },
    pauseGuards: true,
    circuitBreaker: true,
  },
  status: null,
  ventureId: null,
});

type AppState = {
  address: string | null;
  chainId: number | null;
  referralCode: string;
  draft: FactoryDraft;
  setWallet: (address: string | null, chainId: number | null) => void;
  setDraft: (patch: Partial<FactoryDraft>) => void;
  resetDraft: () => void;
  ensureReferral: () => string;
};

function makeCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `ARC-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export const useArclenos = create<AppState>()(
  persist(
    (set, get) => ({
      address: null,
      chainId: null,
      referralCode: "",
      draft: defaultDraft(),
      setWallet: (address, chainId) => set({ address, chainId }),
      setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
      resetDraft: () => set({ draft: defaultDraft() }),
      ensureReferral: () => {
        const existing = get().referralCode;
        if (existing) return existing;
        const code = makeCode();
        set({ referralCode: code });
        return code;
      },
    }),
    {
      name: "arclenos.v1",
      partialize: (s) => ({ referralCode: s.referralCode, draft: s.draft }),
    },
  ),
);
