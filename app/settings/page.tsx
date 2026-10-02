"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Code2 } from "lucide-react";
import { useApp, type Lang } from "@/lib/store";
import { LANGUAGES, useT } from "@/lib/i18n";
import { BANKS } from "@/lib/banks";
import type { Carrier, Sim } from "@/lib/upi/rails";
import { UPI123PAY_DEFAULT_CAP, UPI123PAY_RBI_CAP, VPA_REGEX } from "@/lib/upi/constants";
import { Glass, Header, Segmented, Toggle, Field, inputCls } from "@/components/ui";

const CARRIERS: Carrier[] = ["jio", "airtel", "vi", "bsnl", "other"];
const selectCls = "glass h-12 w-full rounded-2xl px-3 font-semibold text-ink outline-none";

export default function SettingsPage() {
  const t = useT();
  const router = useRouter();
  const { settings: s, setSettings, reset } = useApp();
  const setSim = (slot: 1 | 2, carrier: Carrier | "none") => {
    const others = s.sims.filter((x) => x.slot !== slot);
    const sims: Sim[] = carrier === "none" ? others : [...others, { slot, carrier }];
    setSettings({ sims: sims.sort((a, b) => a.slot - b.slot) });
  };
  const simOf = (slot: 1 | 2) => s.sims.find((x) => x.slot === slot)?.carrier ?? "none";

  return (
    <div className="pb-8">
      <Header title={t("settings.title")} />
      <div className="space-y-4 px-5">
        <Glass className="space-y-4 p-4">
          <Field label={t("settings.language")}>
            <Segmented label={t("settings.language")} value={s.lang} onChange={(v) => setSettings({ lang: v as Lang })} options={LANGUAGES.map((l) => ({ id: l.id, label: l.native }))} />
          </Field>
          <Field label={t("settings.theme")}>
            <Segmented label={t("settings.theme")} value={s.theme} onChange={(v) => setSettings({ theme: v })} options={[{ id: "day", label: t("settings.theme.day") }, { id: "night", label: t("settings.theme.night") }]} />
          </Field>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">{t("settings.lite")}</p>
              <p className="text-xs text-ink-soft">{t("settings.lite.sub")}</p>
            </div>
            <Toggle checked={s.lite} onChange={(v) => setSettings({ lite: v })} label={t("settings.lite")} />
          </div>
        </Glass>

        <Glass className="space-y-4 p-4">
          <p className="font-bold">{t("settings.sims")}</p>
          <div className="grid grid-cols-2 gap-3">
            {([1, 2] as const).map((slot) => (
              <Field key={slot} label={t("onb.sim", { n: slot })}>
                <select className={selectCls} value={simOf(slot)} onChange={(e) => setSim(slot, e.target.value as Carrier | "none")}>
                  {slot === 2 && <option value="none">{t("onb.sim.none")}</option>}
                  {CARRIERS.map((c) => (
                    <option key={c} value={c}>{c === "vi" ? "Vi" : c === "bsnl" ? "BSNL" : c[0].toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <Field label={t("settings.bank")}>
            <select className={selectCls} value={s.bank} onChange={(e) => setSettings({ bank: e.target.value })}>
              {BANKS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </Field>
          <Field label={t("settings.ivrCap")} hint={t("settings.ivrCap.sub")}>
            <Segmented
              label={t("settings.ivrCap")}
              value={String(s.ivrCap)}
              onChange={(v) => setSettings({ ivrCap: Number(v) })}
              options={[{ id: String(UPI123PAY_DEFAULT_CAP), label: "₹4,999" }, { id: String(UPI123PAY_RBI_CAP), label: "₹10,000" }]}
            />
          </Field>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">Demo: pretend offline</p>
              <p className="text-xs text-ink-soft">Shows offline routing while your laptop has internet</p>
            </div>
            <Toggle checked={s.demoOffline} onChange={(v) => setSettings({ demoOffline: v })} label="Pretend offline" />
          </div>
        </Glass>

        <Glass className="space-y-3 p-4">
          <p className="font-bold">{t("settings.profile")}</p>
          <Field label={t("onb.profile.name")}>
            <input className={inputCls} value={s.name} onChange={(e) => setSettings({ name: e.target.value })} maxLength={40} />
          </Field>
          <Field label={t("onb.profile.upi")} error={s.upiId && !VPA_REGEX.test(s.upiId) ? "name@bank" : null}>
            <input className={inputCls} value={s.upiId} onChange={(e) => setSettings({ upiId: e.target.value.replace(/\s/g, "") })} placeholder="9876543210@ybl" autoCapitalize="none" />
          </Field>
        </Glass>

        <Glass className="divide-y divide-white/40 p-2">
          <Link href="/pro" className="flex items-center justify-between px-3 py-3 font-semibold">
            {t("settings.plan")} <span className="flex items-center gap-1 capitalize text-ink-soft">{s.plan} <ChevronRight size={18} /></span>
          </Link>
          <a href="https://github.com/axoxal/liquidpay" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-3 font-semibold">
            <Code2 size={18} /> {t("settings.about")}
          </a>
          <button
            type="button"
            onClick={() => {
              if (confirm(t("settings.reset.confirm"))) {
                reset();
                router.replace("/onboarding");
              }
            }}
            className="w-full px-3 py-3 text-left font-semibold text-danger"
          >
            {t("settings.reset")}
          </button>
        </Glass>
      </div>
    </div>
  );
}
