"use client";

import Link from "next/link";
import { BadgeIndianRupee, FileBarChart, QrCode, Users, Volume2 } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { inr } from "@/lib/format";
import { Button, Glass, Header, Pill } from "@/components/ui";

export default function Merchant() {
  const t = useT();
  const { txns, settings, setSettings } = useApp();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const credits = txns.filter((x) => x.direction === "CREDIT" && x.status === "SUCCESS" && x.at >= today.getTime());
  const total = credits.reduce((s, x) => s + Number(x.amount), 0);
  const isBiz = settings.plan === "business";

  const speak = () => {
    const u = new SpeechSynthesisUtterance(settings.lang === "hi" ? `LiquidPay पर ${total} रुपये प्राप्त हुए` : `Received ${total} rupees on LiquidPay`);
    u.lang = settings.lang === "hi" ? "hi-IN" : settings.lang === "ml" ? "ml-IN" : "en-IN";
    speechSynthesis.speak(u);
  };

  return (
    <div className="pb-8">
      <Header title={t("merchant.title")} />
      <div className="space-y-4 px-5">
        <p className="text-ink-soft">{t("merchant.sub")}</p>
        <div className="tile bg-forest p-5 text-forest-ink">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold opacity-80">{t("merchant.today")}</p>
            {isBiz ? <Pill tone="lime">Business</Pill> : <Pill tone="glass" className="text-white">{t("common.preview")}</Pill>}
          </div>
          <p className="mt-1 text-5xl font-bold tabular-nums">{inr(total)}</p>
          <p className="mt-1 text-sm text-lime">{t("merchant.count", { n: credits.length })}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/receive" className="tile press flex flex-col gap-6 bg-mint p-4 text-navy">
            <QrCode size={26} /> <span className="font-bold">{t("home.receive")}</span>
          </Link>
          <button type="button" onClick={speak} className="tile press flex flex-col gap-6 bg-sun p-4 text-left text-navy">
            <Volume2 size={26} /> <span className="font-bold">{t("merchant.soundbox")}</span>
          </button>
        </div>

        <Glass className="divide-y divide-white/40 p-2">
          {[
            { Icon: Volume2, k: "merchant.soundbox" as const },
            { Icon: FileBarChart, k: "merchant.report" as const },
            { Icon: Users, k: "merchant.staff" as const },
            { Icon: BadgeIndianRupee, k: "pro.biz.4" as const },
          ].map(({ Icon, k }) => (
            <div key={k} className="flex items-center gap-3 px-3 py-3">
              <Icon size={20} /> <span className="flex-1 font-medium">{t(k)}</span>
              {!isBiz && <Pill tone="lilac">Business</Pill>}
            </div>
          ))}
        </Glass>

        {!isBiz && (
          <Button tone="ink" className="w-full" onClick={() => setSettings({ plan: "business" })}>
            {t("merchant.upgrade")}
          </Button>
        )}
        <p className="text-center text-xs text-ink-soft">{t("pro.demo")}</p>
      </div>
    </div>
  );
}
