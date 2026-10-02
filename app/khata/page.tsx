"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, BellRing, ChevronLeft, Plus } from "lucide-react";
import { useApp, khataBalance, type KhataCustomer } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { inr, initials, timeAgo } from "@/lib/format";
import { normalizeMobile } from "@/lib/upi/dial";
import { Button, Field, Glass, Header, cx, inputCls } from "@/components/ui";

const FREE_LIMIT = 25;

export default function KhataPage() {
  return (
    <Suspense>
      <Khata />
    </Suspense>
  );
}

function Khata() {
  const t = useT();
  const q = useSearchParams();
  const { khata, addCustomer, addKhataEntry, settings } = useApp();
  const prefill = q.get("name");
  const [adding, setAdding] = useState(!!prefill);
  const [name, setName] = useState(prefill ?? "");
  const [phone, setPhone] = useState(q.get("phone")?.includes("@") ? "" : q.get("phone") ?? "");
  const [openId, setOpenId] = useState<string | null>(null);

  const get = khata.reduce((s, c) => s + Math.max(0, khataBalance(c)), 0);
  const give = khata.reduce((s, c) => s + Math.max(0, -khataBalance(c)), 0);
  const atLimit = settings.plan === "free" && khata.length >= FREE_LIMIT;

  const save = () => {
    const id = addCustomer({ name: name.trim(), phone: normalizeMobile(phone) });
    const amt = Number(q.get("amount"));
    // A payment you made to someone = you gave them credit.
    if (prefill && amt > 0) addKhataEntry(id, { amount: amt, type: "gave", note: "LiquidPay" });
    setAdding(false);
    setName("");
    setPhone("");
    setOpenId(id);
  };

  const current = khata.find((c) => c.id === openId);
  if (current) return <Ledger c={current} onBack={() => setOpenId(null)} />;

  return (
    <div>
      <Header title={t("khata.title")} back={false} right={
        <button type="button" onClick={() => setAdding(!adding)} aria-label={t("khata.add")} disabled={atLimit} className="press grid size-11 place-items-center rounded-full bg-navy text-lime disabled:opacity-40">
          <Plus size={22} />
        </button>
      } />
      <div className="space-y-4 px-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="tile bg-mint p-4 text-navy">
            <p className="text-sm font-semibold opacity-70">{t("khata.youGet")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-forest">{inr(get)}</p>
          </div>
          <div className="tile bg-sun p-4 text-navy">
            <p className="text-sm font-semibold opacity-70">{t("khata.youGive")}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{inr(give)}</p>
          </div>
        </div>

        {adding && (
          <Glass className="space-y-3 p-4">
            <Field label={t("khata.name")}>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            </Field>
            <Field label={t("pay.mobile")} hint={t("onb.profile.optional")}>
              <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={16} />
            </Field>
            <Button className="w-full" size="md" disabled={!name.trim()} onClick={save}>
              {t("common.save")}
            </Button>
          </Glass>
        )}
        {atLimit && <p className="rounded-2xl bg-lilac p-3 text-sm font-semibold text-navy">{t("pro.free.2")} · Pro</p>}

        <Glass className="p-2">
          {khata.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-soft">{t("khata.empty")}</p>
          ) : (
            khata.map((c) => {
              const bal = khataBalance(c);
              return (
                <button key={c.id} type="button" onClick={() => setOpenId(c.id)} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky font-bold text-navy">{initials(c.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.name}</span>
                    <span className="block text-xs text-ink-soft">{c.entries[0] ? timeAgo(c.entries[0].at) : "—"}</span>
                  </span>
                  <span className={cx("text-right font-bold tabular-nums", bal > 0 ? "text-forest" : bal < 0 ? "text-danger" : "text-ink-soft")}>
                    {bal === 0 ? t("khata.settled") : inr(Math.abs(bal))}
                    <span className="block text-[10px] font-semibold uppercase text-ink-soft">{bal > 0 ? t("khata.youGet") : bal < 0 ? t("khata.youGive") : ""}</span>
                  </span>
                </button>
              );
            })
          )}
        </Glass>
      </div>
    </div>
  );
}

function Ledger({ c, onBack }: { c: KhataCustomer; onBack: () => void }) {
  const t = useT();
  const add = useApp((s) => s.addKhataEntry);
  const [amount, setAmount] = useState("");
  const bal = khataBalance(c);
  const entry = (type: "gave" | "got") => {
    const v = Number(amount);
    if (v > 0) add(c.id, { amount: v, type });
    setAmount("");
  };
  const remind = () => {
    const msg = `Hi ${c.name}, a friendly reminder: ${inr(bal)} is pending. Pay via UPI anytime. — sent from LiquidPay`;
    const href = c.phone ? `sms:${c.phone}?body=${encodeURIComponent(msg)}` : `sms:?body=${encodeURIComponent(msg)}`;
    window.location.assign(href);
  };
  return (
    <div className="pb-8">
      <header className="flex items-center gap-3 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]">
        <button type="button" onClick={onBack} aria-label={t("common.back")} className="press glass grid size-11 place-items-center rounded-full">
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 truncate text-2xl font-bold">{c.name}</h1>
      </header>
      <div className="space-y-4 px-5">
        <div className={cx("tile p-5", bal >= 0 ? "bg-forest text-forest-ink" : "bg-sun text-navy")}>
          <p className="text-sm font-semibold opacity-80">{bal >= 0 ? t("khata.youGet") : t("khata.youGive")}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{inr(Math.abs(bal))}</p>
          {bal > 0 && (
            <button type="button" onClick={remind} className="press mt-4 inline-flex items-center gap-2 rounded-full bg-lime px-4 py-2 text-sm font-bold text-navy">
              <BellRing size={16} /> {t("khata.remind")}
            </button>
          )}
        </div>
        <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="₹ 0" aria-label={t("pay.amount")} />
        <div className="grid grid-cols-2 gap-3">
          <Button tone="danger" size="md" onClick={() => entry("gave")} disabled={!amount}>
            <ArrowUpRight size={18} /> {t("khata.gave")}
          </Button>
          <Button tone="forest" size="md" onClick={() => entry("got")} disabled={!amount}>
            <ArrowDownLeft size={18} /> {t("khata.got")}
          </Button>
        </div>
        <Glass className="divide-y divide-white/40 p-2">
          {c.entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-3 py-3">
              <span className="text-sm text-ink-soft">{new Date(e.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className={cx("font-bold tabular-nums", e.type === "gave" ? "text-danger" : "text-forest")}>
                {e.type === "gave" ? "−" : "+"}
                {inr(e.amount)}
              </span>
            </div>
          ))}
        </Glass>
      </div>
    </div>
  );
}
