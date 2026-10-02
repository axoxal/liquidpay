"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import { useApp, uid } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { parseBankSms } from "@/lib/upi/sms";
import { demoSender } from "@/lib/banks";
import { TxnRow } from "@/components/TxnRow";
import { Button, Glass, Header, Segmented } from "@/components/ui";

type Filter = "all" | "sent" | "received" | "pending";

export default function ActivityPage() {
  return (
    <Suspense>
      <Activity />
    </Suspense>
  );
}

function Activity() {
  const t = useT();
  const router = useRouter();
  const q = useSearchParams();
  const { txns, addTxn, settings } = useApp();
  const [filter, setFilter] = useState<Filter>((q.get("f") as Filter) ?? "all");
  const [sms, setSms] = useState("");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState(false);

  const list = txns.filter((x) =>
    filter === "all" ? true : filter === "sent" ? x.direction === "DEBIT" && x.status !== "QUEUED" : filter === "received" ? x.direction === "CREDIT" : x.status === "QUEUED",
  );

  const addFromSms = () => {
    const p = parseBankSms(demoSender(settings.bank), sms);
    if (!p) return setErr(true);
    addTxn({
      id: uid(),
      at: p.timestamp,
      amount: p.amount,
      direction: p.direction,
      status: p.status,
      rail: "sms",
      payeeLabel: p.counterparty ?? p.upiId ?? p.phoneNumber ?? p.bankName,
      payeeId: p.upiId ?? p.phoneNumber ?? "",
      bank: p.bankName,
      reference: p.reference,
    });
    setSms("");
    setErr(false);
    setOpen(false);
  };

  return (
    <div>
      <Header title={t("activity.title")} back={false} right={
        <button type="button" onClick={() => setOpen(!open)} aria-label={t("activity.addSms")} className="press glass grid size-11 place-items-center rounded-full">
          <MessageSquarePlus size={20} />
        </button>
      } />
      <div className="space-y-4 px-5">
        <Segmented
          label={t("activity.title")}
          value={filter}
          onChange={setFilter}
          options={[
            { id: "all", label: t("activity.all") },
            { id: "sent", label: t("activity.sent") },
            { id: "received", label: t("activity.received") },
            { id: "pending", label: t("activity.pending") },
          ]}
        />
        {open && (
          <Glass className="space-y-2 p-4">
            <p className="font-semibold">{t("activity.addSms")}</p>
            <textarea value={sms} onChange={(e) => { setSms(e.target.value); setErr(false); }} rows={3} aria-label={t("activity.addSms")} placeholder={t("session.pasteSms.ph")} className="glass w-full rounded-2xl p-3 text-sm outline-none" />
            {err && <p role="alert" className="text-sm font-semibold text-danger">{t("session.reject.NOT_BANK_TXN")}</p>}
            <Button size="md" className="w-full" disabled={!sms.trim()} onClick={addFromSms}>
              {t("common.save")}
            </Button>
          </Glass>
        )}
        <Glass className="p-2">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-ink-soft">{t("activity.empty")}</p>
          ) : (
            list.map((x) => (
              <TxnRow
                key={x.id}
                txn={x}
                onClick={
                  x.status === "QUEUED"
                    ? () => {
                        const p = new URLSearchParams(x.payeeId.includes("@") ? { vpa: x.payeeId, am: x.amount } : { phone: x.payeeId });
                        if (x.payeeLabel) p.set("pn", x.payeeLabel);
                        useApp.getState().removeTxn(x.id);
                        router.push(`/pay?${p}`);
                      }
                    : undefined
                }
              />
            ))
          )}
        </Glass>
      </div>
    </div>
  );
}
