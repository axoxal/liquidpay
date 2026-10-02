"use client";

import { Check } from "lucide-react";
import { useApp, type Plan } from "@/lib/store";
import { useT, type MessageKey } from "@/lib/i18n";
import { Button, Header, cx } from "@/components/ui";

const PLANS: { id: Plan; name: string; price: number; tone: string; btn: "glass" | "lime" | "ink"; features: MessageKey[] }[] = [
  { id: "free", name: "Free", price: 0, tone: "glass", btn: "glass", features: ["pro.free.1", "pro.free.2", "pro.free.3"] },
  { id: "pro", name: "Pro", price: 49, tone: "bg-lilac text-navy", btn: "ink", features: ["pro.pro.1", "pro.pro.2", "pro.pro.3", "pro.pro.4"] },
  { id: "business", name: "Business", price: 99, tone: "bg-navy text-white", btn: "lime", features: ["pro.biz.1", "pro.biz.2", "pro.biz.3", "pro.biz.4"] },
];

export default function Pro() {
  const t = useT();
  const { settings, setSettings } = useApp();
  return (
    <div className="pb-8">
      <Header title={t("pro.title")} />
      <div className="space-y-4 px-5">
        <p className="text-ink-soft">{t("pro.sub")}</p>
        {PLANS.map((p) => {
          const current = settings.plan === p.id;
          return (
            <div key={p.id} className={cx("tile p-5", p.tone)}>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-bold">{p.name}</p>
                <p className="text-2xl font-bold">
                  {p.price ? `₹${p.price}` : t("common.free")}
                  {p.price > 0 && <span className="text-sm font-medium opacity-70">{t("pro.month")}</span>}
                </p>
              </div>
              <ul className="mt-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm font-medium">
                    <Check size={18} className="shrink-0" /> {t(f)}
                  </li>
                ))}
              </ul>
              <Button tone={p.btn} size="md" className="mt-5 w-full" disabled={current} onClick={() => setSettings({ plan: p.id })}>
                {current ? t("pro.current") : t("pro.choose")}
              </Button>
            </div>
          );
        })}
        <p className="text-center text-xs text-ink-soft">{t("pro.demo")}</p>
      </div>
    </div>
  );
}
