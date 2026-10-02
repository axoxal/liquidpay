"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, PhoneCall, ShieldCheck, MessageSquareLock } from "lucide-react";
import { useApp, type Lang } from "@/lib/store";
import { LANGUAGES, useT } from "@/lib/i18n";
import { BANKS } from "@/lib/banks";
import type { Carrier, Sim } from "@/lib/upi/rails";
import { VPA_REGEX } from "@/lib/upi/constants";
import { LogoMark } from "@/components/Logo";
import { Button, Field, Glass, cx, inputCls } from "@/components/ui";

const CARRIERS: { id: Carrier | "none"; label: string; tone: string }[] = [
  { id: "jio", label: "Jio", tone: "bg-sky" },
  { id: "airtel", label: "Airtel", tone: "bg-sun" },
  { id: "vi", label: "Vi", tone: "bg-lilac" },
  { id: "bsnl", label: "BSNL", tone: "bg-mint" },
  { id: "other", label: "Other", tone: "bg-stone" },
];

export default function Onboarding() {
  const t = useT();
  const router = useRouter();
  const { settings, setSettings } = useApp();
  const [step, setStep] = useState(0);
  const [sim1, setSim1] = useState<Carrier>(settings.sims[0]?.carrier ?? "jio");
  const [sim2, setSim2] = useState<Carrier | "none">(settings.sims[1]?.carrier ?? "none");
  const [bank, setBank] = useState(settings.bank);
  const [name, setName] = useState(settings.name);
  const [upiId, setUpiId] = useState(settings.upiId);
  const [agreed, setAgreed] = useState(false);

  const upiError = upiId && !VPA_REGEX.test(upiId.trim()) ? "name@bank" : null;
  const steps = 5;

  const finish = () => {
    const sims: Sim[] = [{ slot: 1, carrier: sim1 }];
    if (sim2 !== "none") sims.push({ slot: 2, carrier: sim2 });
    setSettings({ sims, bank, name: name.trim(), upiId: upiId.trim(), onboarded: true });
    router.replace("/");
  };

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-[max(env(safe-area-inset-top),20px)]">
      <div className="flex items-center justify-between">
        <LogoMark size={44} />
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${steps}`}>
          {Array.from({ length: steps }).map((_, i) => (
            <span key={i} className={cx("h-2 rounded-full transition-all", i === step ? "w-7 bg-navy" : "w-2 bg-white/60")} />
          ))}
        </div>
      </div>

      <div className="flex-1 pt-8">
        {step === 0 && (
          <>
            <div className="relative mb-8 h-48">
              <div className="tile absolute left-0 top-2 rotate-[-8deg] bg-forest px-5 py-4 text-forest-ink">
                <p className="text-2xl font-bold leading-tight">
                  Super Easy
                  <br />
                  and Fast
                </p>
                <p className="mt-1 text-sm text-lime">बेहद आसान<br />വളരെ എളുപ്പം</p>
              </div>
              <div className="tile absolute right-0 top-14 rotate-[6deg] bg-sun px-5 py-4 text-navy">
                <p className="flex items-center gap-2 text-2xl font-bold">
                  <PhoneCall size={24} /> No data
                </p>
              </div>
              <div className="tile absolute bottom-0 left-12 rotate-[-2deg] bg-lilac px-4 py-3 text-navy">
                <p className="flex items-center gap-2 font-semibold">
                  <Lock size={18} /> PIN stays with your bank
                </p>
              </div>
            </div>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight">{t("onb.welcome.title")}</h1>
            <p className="mt-3 text-lg text-ink-soft">{t("onb.welcome.body")}</p>
            <h2 className="mt-8 mb-3 font-semibold">{t("onb.lang")}</h2>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("onb.lang")}>
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.lang === l.id}
                  onClick={() => setSettings({ lang: l.id as Lang })}
                  className={cx(
                    "press rounded-2xl px-2 py-4 text-center font-semibold",
                    settings.lang === l.id ? "bg-navy text-white" : "glass",
                  )}
                >
                  <span className="block text-lg">{l.native}</span>
                  <span className="text-xs opacity-70">{l.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{t("onb.sims.title")}</h1>
            <p className="mt-2 text-ink-soft">{t("onb.sims.body")}</p>
            {[1, 2].map((slot) => {
              const value = slot === 1 ? sim1 : sim2;
              const opts = slot === 1 ? CARRIERS.filter((c) => c.id !== "none") : [...CARRIERS, { id: "none" as const, label: t("onb.sim.none"), tone: "bg-white/60" }];
              return (
                <Glass key={slot} className="mt-5 p-4">
                  <p className="mb-3 font-semibold">{t("onb.sim", { n: slot })}</p>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("onb.sim", { n: slot })}>
                    {opts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={value === c.id}
                        onClick={() => (slot === 1 ? setSim1(c.id as Carrier) : setSim2(c.id))}
                        className={cx(
                          "press rounded-full px-4 py-2.5 font-semibold text-navy",
                          c.tone,
                          value === c.id ? "ring-4 ring-navy" : "opacity-80",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Glass>
              );
            })}
            {(sim1 === "jio" || sim2 === "jio") && (
              <p className="mt-4 rounded-2xl bg-sky/80 p-3 text-sm font-medium text-navy">{t("scan.jioNote")}</p>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{t("onb.bank.title")}</h1>
            <p className="mt-2 text-ink-soft">{t("onb.bank.body")}</p>
            <div className="mt-5 grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("onb.bank.title")}>
              {BANKS.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={bank === b}
                  onClick={() => setBank(b)}
                  className={cx("press rounded-2xl px-3 py-3 text-left text-sm font-semibold", bank === b ? "bg-navy text-white" : "glass")}
                >
                  {b}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-3xl font-bold tracking-tight">{t("onb.profile.title")}</h1>
            <div className="mt-6 space-y-4">
              <Field label={t("onb.profile.name")}>
                <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={40} />
              </Field>
              <Field label={t("onb.profile.upi")} hint={t("onb.profile.optional")} error={upiError}>
                <input
                  className={inputCls}
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value.replace(/\s/g, ""))}
                  placeholder="9876543210@ybl"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </Field>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="tile mb-6 inline-flex items-center gap-3 bg-stone px-5 py-4 text-navy">
              <span className="text-3xl font-bold leading-none tracking-tight">{t("onb.trust.title")}</span>
              <Lock size={28} />
            </div>
            <ul className="space-y-3">
              {[
                { Icon: Lock, k: "onb.trust.1" as const, tone: "bg-lime" },
                { Icon: MessageSquareLock, k: "onb.trust.2" as const, tone: "bg-mint" },
                { Icon: ShieldCheck, k: "onb.trust.3" as const, tone: "bg-lilac" },
              ].map(({ Icon, k, tone }) => (
                <li key={k} className="glass flex items-start gap-3 rounded-3xl p-4">
                  <span className={cx("grid size-10 shrink-0 place-items-center rounded-2xl text-navy", tone)}>
                    <Icon size={20} />
                  </span>
                  <span className="pt-1.5 font-medium">{t(k)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              role="checkbox"
              aria-checked={agreed}
              onClick={() => setAgreed(!agreed)}
              className="mt-5 flex w-full items-start gap-3 rounded-3xl p-2 text-left"
            >
              <span className={cx("grid size-7 shrink-0 place-items-center rounded-lg border-2 border-navy", agreed && "bg-navy text-lime")}>
                {agreed && <Check size={18} />}
              </span>
              <span className="text-sm text-ink-soft">{t("onb.trust.agree")}</span>
            </button>
          </>
        )}
      </div>

      <div className="flex gap-3 pt-6">
        {step > 0 && (
          <Button tone="glass" onClick={() => setStep(step - 1)}>
            {t("common.back")}
          </Button>
        )}
        {step < steps - 1 ? (
          <Button className="flex-1" onClick={() => setStep(step + 1)} disabled={(step === 2 && !bank) || (step === 3 && !!upiError)}>
            {t("common.continue")}
          </Button>
        ) : (
          <Button tone="lime" className="flex-1" onClick={finish} disabled={!agreed}>
            {t("onb.start")}
          </Button>
        )}
      </div>
    </div>
  );
}
