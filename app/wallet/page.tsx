"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, KeyRound, PenLine, ShieldCheck, Info } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Button, Glass, Header, Pill, cx } from "@/components/ui";

// PREVIEW ONLY. Every number on this screen is static demo data. No keys are
// generated, no network calls are made, and nothing here can move funds.
const DEMO_ASSETS = [
  { sym: "USDC", name: "USD Coin · Base", amount: 124.5, inr: 10420, tone: "bg-sky" },
  { sym: "ETH", name: "Ether · Base", amount: 0.012, inr: 2980, tone: "bg-lilac" },
  { sym: "POL", name: "Polygon", amount: 41.2, inr: 1210, tone: "bg-violet text-white" },
  { sym: "BTC", name: "Bitcoin", amount: 0.0004, inr: 2310, tone: "bg-sun" },
];

export default function Wallet() {
  const t = useT();
  const { settings, setSettings } = useApp();
  const [toast, setToast] = useState(false);
  const total = DEMO_ASSETS.reduce((s, a) => s + a.inr, 0);

  const demo = () => {
    setToast(true);
    setTimeout(() => setToast(false), 1800);
  };

  return (
    <div className="pb-8">
      <Header title={t("wallet.title")} back={false} right={<Pill tone="sun">{t("common.preview")}</Pill>} />
      <div className="space-y-4 px-5">
        <p className="flex items-center gap-2 rounded-2xl bg-sun/80 px-3 py-2 text-sm font-semibold text-navy">
          <Info size={16} /> {t("wallet.preview")}
        </p>

        {/* Card — the dark starfield "debit card" tile from the moodboard */}
        <div className="tile relative overflow-hidden bg-navy p-5 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), radial-gradient(1px 1px at 40% 80%, #fff, transparent), radial-gradient(1px 1px at 85% 20%, #fff, transparent)" }} />
          <div className="relative flex items-center justify-between">
            <p className="text-sm text-white/60">{t("wallet.total")}</p>
            <span className="flex">
              <span className="size-6 rounded-full border-2 border-white/80" />
              <span className="-ml-2 size-6 rounded-full border-2 border-white/80" />
            </span>
          </div>
          <p className="relative mt-2 text-4xl font-bold tabular-nums">₹{total.toLocaleString("en-IN")}</p>
          <p className="relative mt-1 font-mono text-xs text-mint">0x7a3f…c91e · demo</p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {[
            { Icon: ArrowUpRight, k: "wallet.send" as const, tone: "bg-lilac" },
            { Icon: ArrowDownLeft, k: "wallet.receive" as const, tone: "bg-mint" },
            { Icon: ArrowLeftRight, k: "wallet.swap" as const, tone: "bg-sun" },
            { Icon: PenLine, k: "wallet.offlineSign" as const, tone: "bg-lime" },
          ].map(({ Icon, k, tone }) => (
            <button key={k} type="button" onClick={demo} className="press flex flex-col items-center gap-1.5">
              <span className={cx("tile grid size-14 place-items-center text-navy", tone)}>
                <Icon size={22} />
              </span>
              <span className="text-center text-xs font-semibold leading-tight">{t(k)}</span>
            </button>
          ))}
        </div>

        <div className="tile flex items-center gap-3 bg-lime p-4 text-navy">
          <PenLine size={24} />
          <div>
            <p className="font-bold">{t("wallet.offlineSign")}</p>
            <p className="text-sm opacity-80">{t("wallet.offlineSign.sub")}</p>
          </div>
        </div>

        <Glass className="p-2">
          <p className="px-3 pb-1 pt-2 text-sm font-bold text-ink-soft">{t("wallet.assets")}</p>
          {DEMO_ASSETS.map((a) => (
            <div key={a.sym} className="flex items-center gap-3 px-2 py-2.5">
              <span className={cx("grid size-11 place-items-center rounded-2xl text-xs font-bold text-navy", a.tone)}>{a.sym}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{a.sym}</span>
                <span className="block text-xs text-ink-soft">{a.name}</span>
              </span>
              <span className="text-right">
                <span className="block font-bold tabular-nums">₹{a.inr.toLocaleString("en-IN")}</span>
                <span className="block text-xs tabular-nums text-ink-soft">{a.amount} {a.sym}</span>
              </span>
            </div>
          ))}
        </Glass>

        <Glass className="space-y-3 p-4 text-sm">
          <p className="flex gap-2"><KeyRound size={18} className="shrink-0" /> {t("wallet.selfCustody")}</p>
          <p className="flex gap-2"><ShieldCheck size={18} className="shrink-0" /> {t("wallet.tax")}</p>
        </Glass>

        <Button tone={settings.walletWaitlist ? "mint" : "ink"} className="w-full" onClick={() => setSettings({ walletWaitlist: true })} disabled={settings.walletWaitlist}>
          {settings.walletWaitlist ? t("wallet.joined") : t("wallet.waitlist")}
        </Button>
      </div>
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-32 z-50 mx-auto w-fit rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white shadow-xl">
          {t("common.soon")} · {t("common.preview")}
        </div>
      )}
    </div>
  );
}
