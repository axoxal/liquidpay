"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Sim } from "./upi/rails";
import type { RailId } from "./upi/rails";
import type { Session } from "./upi/session";
import { UPI123PAY_DEFAULT_CAP } from "./upi/constants";

export type Lang = "en" | "hi" | "ml";
export type Plan = "free" | "pro" | "business";
export type TxnStatus = "SUCCESS" | "FAILED" | "UNVERIFIED" | "QUEUED";

export interface Txn {
  id: string;
  at: number;
  amount: string;
  direction: "DEBIT" | "CREDIT";
  status: TxnStatus;
  rail: RailId | "sms";
  payeeLabel: string;
  payeeId: string;
  bank?: string;
  reference?: string | null;
  note?: string;
}

export interface KhataEntry {
  id: string;
  at: number;
  amount: number;
  /** gave = customer owes you more; got = customer paid you. */
  type: "gave" | "got";
  note?: string;
}
export interface KhataCustomer {
  id: string;
  name: string;
  phone: string;
  entries: KhataEntry[];
}

export interface Settings {
  onboarded: boolean;
  lang: Lang;
  theme: "day" | "night";
  lite: boolean;
  sims: Sim[];
  bank: string;
  ivrCap: number;
  name: string;
  upiId: string;
  plan: Plan;
  walletWaitlist: boolean;
  /** Demo: pretend there is no internet so offline routing can be shown on desktop. */
  demoOffline: boolean;
  /** Show sample QRs and the simulated bank SMS button. */
  demoTools: boolean;
}

interface State {
  settings: Settings;
  txns: Txn[];
  khata: KhataCustomer[];
  session: Session | null;
  setSettings: (p: Partial<Settings>) => void;
  addTxn: (t: Txn) => void;
  updateTxn: (id: string, p: Partial<Txn>) => void;
  removeTxn: (id: string) => void;
  setSession: (s: Session | null) => void;
  addCustomer: (c: Omit<KhataCustomer, "id" | "entries">) => string;
  addKhataEntry: (customerId: string, e: Omit<KhataEntry, "id" | "at">) => void;
  reset: () => void;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const defaultSettings: Settings = {
  onboarded: false,
  lang: "en",
  theme: "day",
  lite: false,
  sims: [{ slot: 1, carrier: "jio" }],
  bank: "",
  ivrCap: UPI123PAY_DEFAULT_CAP,
  name: "",
  upiId: "",
  plan: "free",
  walletWaitlist: false,
  demoOffline: false,
  demoTools: false,
};

export const useApp = create<State>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      txns: [],
      khata: [],
      session: null,
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      addTxn: (t) => set((s) => ({ txns: [t, ...s.txns] })),
      updateTxn: (id, p) => set((s) => ({ txns: s.txns.map((t) => (t.id === id ? { ...t, ...p } : t)) })),
      removeTxn: (id) => set((s) => ({ txns: s.txns.filter((t) => t.id !== id) })),
      setSession: (session) => set({ session }),
      addCustomer: (c) => {
        const id = uid();
        set((s) => ({ khata: [{ ...c, id, entries: [] }, ...s.khata] }));
        return id;
      },
      addKhataEntry: (customerId, e) =>
        set((s) => ({
          khata: s.khata.map((c) =>
            c.id === customerId ? { ...c, entries: [{ ...e, id: uid(), at: Date.now() }, ...c.entries] } : c,
          ),
        })),
      reset: () => set({ settings: defaultSettings, txns: [], khata: [], session: null }),
    }),
    {
      name: "liquidpay",
      version: 1,
      // Deep-merge settings so fields added in later releases get their defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return { ...current, ...p, settings: { ...current.settings, ...p.settings } };
      },
    },
  ),
);

/** Positive = customer owes you. */
export const khataBalance = (c: KhataCustomer) =>
  c.entries.reduce((sum, e) => sum + (e.type === "gave" ? e.amount : -e.amount), 0);
