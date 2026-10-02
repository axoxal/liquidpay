"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookUser, Store } from "lucide-react";
import { useApp, uid } from "@/lib/store";
import { useOnline } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { routePayment, type PayTarget, type RailId } from "@/lib/upi/rails";
import { normalizeMobile } from "@/lib/upi/dial";
import { PHONE_REGEX } from "@/lib/upi/constants";
import { createSession, reduceSession } from "@/lib/upi/session";
import { copyText, isNativeApp, LiquidPay, openPaymentUri } from "@/lib/native";
import { overlayLabels } from "@/lib/overlay";
import { inr, initials, maskMobile } from "@/lib/format";
import { RailPicker } from "@/components/RailPicker";
import { Button, Field, Glass, Header, inputCls } from "@/components/ui";

interface ContactsManager {
  select(props: string[], opts?: { multiple?: boolean }): Promise<{ name?: string[]; tel?: string[] }[]>;
}

export default function PayPage() {
  return (
    <Suspense>
      <Pay />
    </Suspense>
  );
}

function Pay() {
  const t = useT();
  const router = useRouter();
  const q = useSearchParams();
  const online = useOnline();
  const { settings, setSession, addTxn } = useApp();

  const vpa = q.get("vpa");
  const qrAmount = q.get("am") ?? "";
  const [phone, setPhone] = useState(q.get("phone") ?? "");
  const [name, setName] = useState(q.get("pn") ?? "");
  const [amount, setAmount] = useState(qrAmount);
  const [note, setNote] = useState(q.get("tn") ?? "");
  const [picked, setPicked] = useState<RailId | null>(null);

  const mobile = normalizeMobile(phone);
  const target: PayTarget | null = vpa
    ? { kind: "vpa", vpa, name, note }
    : PHONE_REGEX.test(mobile)
      ? { kind: "mobile", phone: mobile, name }
      : null;

  const options = useMemo(
    () => (target ? routePayment({ target, amount, sims: settings.sims, online, ivrCap: settings.ivrCap, ivrPauses: settings.ivrPauses }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vpa, mobile, name, note, amount, settings.sims, online, settings.ivrCap, settings.ivrPauses],
  );
  const firstLive = options.find((o) => o.available && o.id !== "queue")?.id ?? options.find((o) => o.available)?.id ?? null;
  const railId = picked && options.find((o) => o.id === picked)?.available ? picked : firstLive;
  const rail = options.find((o) => o.id === railId);

  const payeeLabel = name || (vpa ?? maskMobile(mobile));
  const payeeId = vpa ?? mobile;
  const amountValid = Number(amount) >= 1;
  const contactsApi = typeof navigator !== "undefined" ? (navigator as Navigator & { contacts?: ContactsManager }).contacts : undefined;
  const canPick = isNativeApp() || !!contactsApi;

  const pickContact = async () => {
    try {
      if (isNativeApp()) {
        const c = await LiquidPay.pickContact();
        setPhone(normalizeMobile(c.phone));
        if (c.name) setName(c.name);
        return;
      }
      const [c] = (await contactsApi?.select(["name", "tel"])) ?? [];
      if (c?.tel?.[0]) setPhone(normalizeMobile(c.tel[0]));
      if (c?.name?.[0]) setName(c.name[0]);
    } catch {
      /* user dismissed */
    }
  };

  const go = async () => {
    if (!rail || !target || !amountValid) return;
    if (rail.id === "queue") {
      addTxn({ id: uid(), at: Date.now(), amount, direction: "DEBIT", status: "QUEUED", rail: "queue", payeeLabel, payeeId, note });
      router.replace("/activity?f=pending");
      return;
    }
    if (isNativeApp() && rail.href?.startsWith("tel:")) {
      const p = await LiquidPay.checkPermissions();
      if (p.phone !== "granted") {
        const r = await LiquidPay.requestPermissions({ permissions: ["phone", "sms", "answer"] });
        if (r.phone !== "granted") return;
      }
    }
    const now = Date.now();
    const s = reduceSession(createSession({ id: uid(), rail: rail.id, amount, payeeLabel, payeeId }, now), { type: "DIAL", now });
    setSession(s);
    if (rail.copyText) await copyText(rail.copyText);
    if (rail.href) await openPaymentUri(rail.href, { simSlot: rail.simSlot, rail: rail.id, labels: overlayLabels(t, payeeLabel, amount), listen: settings.ivrListen });
    router.push("/session");
  };

  return (
    <div className="pb-8">
      <Header title={t("pay.title")} />
      <div className="space-y-4 px-5">
        {vpa ? (
          <Glass className="flex items-center gap-3 p-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-forest text-lime">
              <Store size={26} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">{name || vpa}</p>
              <p className="truncate text-sm text-ink-soft">{vpa}</p>
            </div>
          </Glass>
        ) : (
          <>
            <Field label={t("pay.mobile")} error={phone.length >= 10 && !PHONE_REGEX.test(mobile) ? t("pay.invalid.mobile") : null}>
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t("pay.mobile.ph")}
                  maxLength={16}
                />
                {canPick && (
                  <button type="button" onClick={pickContact} aria-label="Pick contact" className="press glass grid size-14 shrink-0 place-items-center rounded-2xl">
                    <BookUser size={22} />
                  </button>
                )}
              </div>
            </Field>
            {PHONE_REGEX.test(mobile) && (
              <Field label={t("pay.to")}>
                <div className="flex items-center gap-3">
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-lilac font-bold text-navy">{initials(name || "?")}</span>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={maskMobile(mobile)} maxLength={40} />
                </div>
              </Field>
            )}
          </>
        )}

        <Field label={t("pay.amount")}>
          <div className="glass flex items-center rounded-3xl px-5 py-3">
            <span className="text-4xl font-bold text-ink-soft">₹</span>
            <input
              className="w-full bg-transparent px-2 text-5xl font-bold tracking-tight outline-none tabular-nums"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").replace(/(\.\d{2}).+/, "$1"))}
              readOnly={!!qrAmount}
              inputMode="decimal"
              placeholder="0"
              aria-label={t("pay.amount")}
            />
          </div>
        </Field>

        {!qrAmount && (
          <div className="flex gap-2">
            {[50, 100, 200, 500].map((v) => (
              <button key={v} type="button" onClick={() => setAmount(String(v))} className="press glass flex-1 rounded-full py-2 text-sm font-semibold">
                {inr(v)}
              </button>
            ))}
          </div>
        )}

        <Field label={t("pay.note")}>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} maxLength={50} />
        </Field>

        {target && amountValid && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-soft">{t("pay.routes")}</p>
            <RailPicker options={options} value={railId} onChange={setPicked} ivrCap={settings.ivrCap} />
          </div>
        )}

        <Button tone={rail?.id === "queue" ? "sky" : "lime"} className="w-full" disabled={!target || !amountValid || !rail} onClick={go}>
          {rail?.id === "queue" ? t("pay.queue") : t("pay.go", { amount: amountValid ? Number(amount).toLocaleString("en-IN") : "0" })}
        </Button>
      </div>
    </div>
  );
}
