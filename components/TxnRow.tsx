"use client";

import { ArrowDownLeft, ArrowUpRight, Clock, ShieldAlert, X } from "lucide-react";
import type { Txn } from "@/lib/store";
import { inr, initials, timeAgo } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cx } from "./ui";

const statusTone: Record<Txn["status"], string> = {
  SUCCESS: "bg-mint text-forest",
  FAILED: "bg-danger/15 text-danger",
  UNVERIFIED: "bg-sun/70 text-navy",
  QUEUED: "bg-sky text-navy",
};

export function TxnRow({ txn, onClick }: { txn: Txn; onClick?: () => void }) {
  const t = useT();
  const credit = txn.direction === "CREDIT";
  const Icon =
    txn.status === "FAILED" ? X : txn.status === "QUEUED" ? Clock : txn.status === "UNVERIFIED" ? ShieldAlert : credit ? ArrowDownLeft : ArrowUpRight;
  return (
    <button type="button" onClick={onClick} className="press flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left">
      <span className="relative grid size-12 shrink-0 place-items-center rounded-2xl bg-white/50 text-sm font-bold text-navy">
        {initials(txn.payeeLabel)}
        <span className={cx("absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full", statusTone[txn.status])}>
          <Icon size={12} strokeWidth={3} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{txn.payeeLabel}</span>
        <span className="block truncate text-xs text-ink-soft">
          {t(`status.${txn.status}`)} · {txn.rail === "ivr123" ? "123Pay" : txn.rail === "ussd" ? "*99#" : txn.rail === "online" ? "UPI" : txn.rail === "sms" ? "SMS" : "—"} · {timeAgo(txn.at)}
        </span>
      </span>
      <span className={cx("font-bold tabular-nums", credit ? "text-forest" : "", txn.status === "FAILED" && "line-through opacity-50")}>
        {credit ? "+" : "−"}
        {inr(txn.amount)}
      </span>
    </button>
  );
}
