"use client";

import Link from "next/link";
import { Lock, WifiOff } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { inr } from "@/lib/format";
import { Glass, Header, Section, cx } from "@/components/ui";

const RAILS = [
  { id: "ivr123", label: "123Pay", tone: "bg-lime" },
  { id: "ussd", label: "*99#", tone: "bg-sun" },
  { id: "online", label: "UPI app", tone: "bg-lilac" },
  { id: "sms", label: "SMS", tone: "bg-sky" },
] as const;

export default function Insights() {
  const t = useT();
  const { txns, settings } = useApp();
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const month = txns.filter((x) => x.at >= start.getTime() && (x.status === "SUCCESS" || x.status === "UNVERIFIED"));
  const spent = month.filter((x) => x.direction === "DEBIT").reduce((s, x) => s + Number(x.amount), 0);
  const got = month.filter((x) => x.direction === "CREDIT").reduce((s, x) => s + Number(x.amount), 0);
  const offline = month.filter((x) => x.rail === "ivr123" || x.rail === "ussd").length;
  const byRail = RAILS.map((r) => ({ ...r, total: month.filter((x) => x.rail === r.id).reduce((s, x) => s + Number(x.amount), 0) }));
  const max = Math.max(1, ...byRail.map((r) => r.total));

  // Last 7 days spend bars.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (6 - i));
    const end = d.getTime() + 864e5;
    return {
      label: d.toLocaleDateString("en-IN", { weekday: "narrow" }),
      total: txns.filter((x) => x.direction === "DEBIT" && x.status !== "FAILED" && x.status !== "QUEUED" && x.at >= d.getTime() && x.at < end).reduce((s, x) => s + Number(x.amount), 0),
    };
  });
  const dayMax = Math.max(1, ...days.map((d) => d.total));

  return (
    <div className="pb-8">
      <Header title={t("insights.title")} />
      <div className="px-5">
        <p className="text-sm font-semibold text-ink-soft">{t("insights.month")}</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div className="tile bg-navy p-4 text-white">
            <p className="text-sm text-white/60">{t("insights.spent")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{inr(spent)}</p>
          </div>
          <div className="tile bg-mint p-4 text-navy">
            <p className="text-sm opacity-70">{t("insights.received")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-forest">{inr(got)}</p>
          </div>
        </div>

        <div className="tile mt-3 flex items-center gap-3 bg-sun p-4 text-navy">
          <WifiOff size={26} />
          <p className="flex-1 font-semibold">{t("insights.offlineSaved")}</p>
          <p className="text-3xl font-bold">{offline}</p>
        </div>

        <Glass className="mt-4 p-4">
          <div className="flex h-36 items-end gap-2" role="img" aria-label="Spending over the last 7 days">
            {days.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div className={cx("w-full rounded-xl", i === 6 ? "bg-forest" : "bg-navy/70")} style={{ height: `${Math.max(6, (d.total / dayMax) * 110)}px` }} />
                <span className="text-xs font-semibold text-ink-soft">{d.label}</span>
              </div>
            ))}
          </div>
        </Glass>

        <Section title={t("insights.byRail")}>
          <Glass className="space-y-3 p-4">
            {byRail.map((r) => (
              <div key={r.id}>
                <div className="mb-1 flex justify-between text-sm font-semibold">
                  <span>{r.label}</span>
                  <span className="tabular-nums">{inr(r.total)}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/40">
                  <div className={cx("h-full rounded-full", r.tone)} style={{ width: `${(r.total / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </Glass>
        </Section>

        {settings.plan === "free" && (
          <Link href="/pro" className="tile press mt-4 flex items-center gap-3 bg-lilac p-4 text-navy">
            <Lock size={20} /> <span className="flex-1 text-sm font-semibold">{t("insights.pro")}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
