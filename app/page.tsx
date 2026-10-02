"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  ChevronsRight,
  Clock,
  CreditCard,
  NotebookTabs,
  ScanLine,
  Settings,
  Store,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useOnline } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { Wordmark } from "@/components/Logo";
import { TxnRow } from "@/components/TxnRow";
import { Glass, Pill, Section, Tile } from "@/components/ui";

export default function Home() {
  const t = useT();
  const online = useOnline();
  const { settings, txns } = useApp();
  const queued = txns.filter((x) => x.status === "QUEUED").length;
  const hasJio = settings.sims.some((s) => s.carrier === "jio");

  return (
    <div className="px-5 pt-[max(env(safe-area-inset-top),16px)]">
      <header className="flex items-center justify-between">
        <Wordmark className="text-xl" />
        <Link href="/settings" aria-label={t("settings.title")} className="press glass grid size-11 place-items-center rounded-full">
          <Settings size={20} />
        </Link>
      </header>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-lg font-semibold">{t("home.hello", { name: settings.name || "👋" })}</p>
        <Pill tone={online ? "mint" : "sun"}>
          {online ? <Wifi size={14} /> : <WifiOff size={14} />}
          {online ? t("common.online") : t("common.offline")}
        </Pill>
      </div>

      {/* Hero — the big yellow "Payments" plate */}
      <div className="tile mt-4 flex items-center gap-4 bg-sun px-5 py-6 text-navy">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border-[3px] border-navy">
          <CreditCard size={30} />
        </span>
        <div className="min-w-0">
          <p className="text-4xl font-bold leading-none tracking-tight">{t("home.hero")}</p>
          <p className="mt-1.5 text-sm font-medium opacity-80">
            {online ? t("home.status.online") : t("home.status.offline")}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Tile tone="forest" href="/scan" className="row-span-2 flex min-h-[180px] flex-col justify-between p-5">
          <ScanLine size={34} className="text-lime" />
          <div>
            <p className="text-2xl font-bold leading-tight">{t("home.scan")}</p>
            {hasJio && <p className="mt-1 text-xs text-lime/90">Jio · 123Pay</p>}
          </div>
        </Tile>
        <Tile tone="lilac" href="/pay" className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-full bg-navy text-lilac">
            <ArrowUpRight size={20} />
          </span>
          <span className="min-w-0 text-[15px] font-bold leading-tight">{t("home.payContact")}</span>
        </Tile>
        <Tile tone="mint" href="/receive" className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-full border-2 border-navy">
            <ArrowDownLeft size={20} />
          </span>
          <span className="min-w-0 text-[15px] font-bold leading-tight">{t("home.receive")}</span>
        </Tile>
      </div>

      <div className="no-scrollbar -mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {[
          { href: "/khata", Icon: NotebookTabs, k: "home.khata" as const, tone: "sky" as const },
          { href: "/insights", Icon: BarChart3, k: "home.insights" as const, tone: "olive" as const },
          { href: "/merchant", Icon: Store, k: "home.merchant" as const, tone: "glass" as const },
          { href: "/pay", Icon: Users, k: "home.payContact" as const, tone: "glass" as const },
        ].map(({ href, Icon, k, tone }) => (
          <Tile key={k + href} tone={tone} href={href} className="flex w-28 shrink-0 flex-col gap-6 p-4">
            <Icon size={24} />
            <span className="text-sm font-bold">{t(k)}</span>
          </Tile>
        ))}
      </div>

      {queued > 0 && (
        <Link href="/activity?f=pending" className="press mt-4 flex items-center gap-3 rounded-3xl bg-navy p-4 text-white">
          <Clock size={20} className="text-sun" />
          <span className="flex-1 text-sm font-semibold">{t("home.pending", { n: queued })}</span>
          <ChevronRight size={18} />
        </Link>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Tile tone="sky" href="/wallet" className="flex flex-col justify-between p-4">
          <p className="text-xl font-bold leading-tight">{t("home.wallet.title")}</p>
          <p className="mt-6 flex items-center justify-between text-xs font-semibold">
            {t("home.wallet.sub")}
            <ChevronsRight size={26} className="shrink-0 text-white" />
          </p>
        </Tile>
        <Tile tone="ink" href="/pro" className="flex flex-col justify-between p-4">
          <p className="font-bold leading-tight">{t("home.pro.title")}</p>
          <p className="mt-1 text-xs text-white/60">{t("home.pro.sub")}</p>
          <span className="mt-4 rounded-full bg-lilac px-3 py-2 text-center text-sm font-bold text-navy">Pro</span>
        </Tile>
      </div>

      <Section
        title={t("home.recent")}
        action={
          txns.length > 0 && (
            <Link href="/activity" className="text-sm font-semibold text-ink-soft">
              {t("common.seeAll")}
            </Link>
          )
        }
      >
        <Glass className="p-2">
          {txns.length === 0 ? (
            <p className="p-4 text-center text-sm text-ink-soft">{t("home.empty")}</p>
          ) : (
            txns.slice(0, 5).map((x) => <TxnRow key={x.id} txn={x} />)
          )}
        </Glass>
      </Section>
    </div>
  );
}
