"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, MessageSquareText, PhoneCall, PhoneOff, ShieldAlert, Sparkles, XCircle, Share2 } from "lucide-react";
import { useApp, type TxnStatus } from "@/lib/store";
import { useT, type MessageKey } from "@/lib/i18n";
import { isTerminal, reduceSession, type SessionEvent, type Session } from "@/lib/upi/session";
import { routePayment } from "@/lib/upi/rails";
import { isNativeApp, LiquidPay, openPaymentUri, platform, copyText } from "@/lib/native";
import { overlayLabels } from "@/lib/overlay";
import { demoSender, demoSmsBody } from "@/lib/banks";
import { inr } from "@/lib/format";
import { useOnline } from "@/lib/hooks";
import { Button, Glass, Header, cx } from "@/components/ui";

const RECORD: Partial<Record<Session["phase"], TxnStatus>> = {
  success: "SUCCESS",
  failed: "FAILED",
  unverified: "UNVERIFIED",
  // cancelled / timeout leave no record — an outcome the bank never confirmed
  // is not one we report (Flowpay's invariant).
};

export default function SessionPage() {
  const t = useT();
  const router = useRouter();
  const online = useOnline();
  const { session, settings, setSession, addTxn } = useApp();
  const [now, setNow] = useState(() => Date.now());
  const [sms, setSms] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [canDial] = useState(() => platform().native || platform().mobile);
  const [callStage, setCallStage] = useState<"calling" | "waiting" | "ringing" | null>(null);

  const dispatch = useCallback(
    (e: SessionEvent) => {
      const cur = useApp.getState().session;
      if (!cur) return;
      const next = reduceSession(cur, e);
      if (next === cur) return;
      setSession(next);
      if (!isTerminal(cur.phase) && isTerminal(next.phase)) {
        const status = RECORD[next.phase];
        if (status)
          addTxn({
            id: next.id,
            at: Date.now(),
            amount: next.confirmation?.amount ?? next.amount,
            direction: "DEBIT",
            status,
            rail: next.rail,
            payeeLabel: next.confirmation?.counterparty && next.payeeLabel.match(/^\d|@/) ? next.confirmation.counterparty : next.payeeLabel,
            payeeId: next.payeeId,
            bank: next.confirmation?.bankName,
            reference: next.confirmation?.reference,
          });
        if (isNativeApp()) {
          // The bank has settled it: hang up any call still open (Flowpay's
          // endCallOnConfirmation), close the SMS window and drop the overlay.
          if (next.phase === "success" || next.phase === "failed") void LiquidPay.endCall().catch(() => {});
          void LiquidPay.finishPayment().catch(() => {});
        }
      }
    },
    [setSession, addTxn],
  );

  // Clock + deadline.
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      dispatch({ type: "TICK", now: n });
    }, 1000);
    return () => clearInterval(id);
  }, [dispatch]);

  // Native Android app: real call-state and bank SMS.
  useEffect(() => {
    if (!isNativeApp()) return;
    const drain = async () => {
      const { messages } = await LiquidPay.takePendingSms();
      for (const m of messages) dispatch({ type: "SMS", sender: m.sender, body: m.body, now: m.at });
    };
    const handles = [
      LiquidPay.addListener("sms", () => void drain()),
      LiquidPay.addListener("callState", (e) => {
        if (e.state === "offhook") setCallStage((s) => (s === "ringing" ? null : s ?? "calling"));
        if (e.state === "ringing") setCallStage("ringing");
        if (e.state === "idle" && e.first) {
          setCallStage("waiting");
          dispatch({ type: "CALL_ENDED", now: Date.now(), durationMs: e.durationMs });
        }
      }),
      LiquidPay.addListener("overlayAction", (e) => {
        if (e.action === "endCall") dispatch({ type: "CALL_ENDED", now: Date.now() });
      }),
    ];
    const onVisible = () => document.visibilityState === "visible" && void drain();
    document.addEventListener("visibilitychange", onVisible);
    void drain();
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      handles.forEach((h) => void h.then((x) => x.remove()));
    };
  }, [dispatch]);

  if (!session) {
    return (
      <div>
        <Header title={t("session.title")} back="/" />
        <div className="px-5">
          <Button className="w-full" onClick={() => router.replace("/")}>
            {t("result.home")}
          </Button>
        </div>
      </div>
    );
  }

  const done = isTerminal(session.phase);
  if (done) return <Result session={session} onHome={() => { setSession(null); router.replace("/"); }} />;

  // Rebuild the href for "call again" from the stored payee.
  const opt = routePayment({
    target: session.payeeId.includes("@") ? { kind: "vpa", vpa: session.payeeId } : { kind: "mobile", phone: session.payeeId },
    amount: session.amount,
    sims: settings.sims,
    online,
    ivrCap: settings.ivrCap,
  }).find((o) => o.id === session.rail);

  const left = Math.max(0, (session.deadline ?? now) - now);
  const mm = String(Math.floor(left / 60000));
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");

  const steps: MessageKey[] =
    session.rail === "ivr123"
      ? ["session.step.ivr.1", "session.step.ivr.2", "session.step.ivr.3"]
      : session.rail === "ussd"
        ? ["session.step.ussd.1", "session.step.ussd.2", "session.step.ussd.3"]
        : ["session.step.online.1"];

  const submitSms = (body: string) => {
    // A pasted SMS is attributed to the user's bank header; the parser still
    // requires a transaction verb and a paise-exact amount match.
    dispatch({ type: "SMS", sender: demoSender(settings.bank), body, now: Date.now() });
    setSms("");
  };

  return (
    <div className="pb-8">
      <Header title={t("session.title")} back={false} right={
        <button type="button" onClick={() => { dispatch({ type: "CANCEL" }); if (isNativeApp()) void LiquidPay.finishPayment().catch(() => {}); }} className="press glass rounded-full px-4 py-2 text-sm font-semibold">
          {t("common.cancel")}
        </button>
      } />
      <div className="space-y-4 px-5">
        <div className="tile bg-navy p-5 text-white">
          <p className="text-sm text-white/60">{session.payeeLabel}</p>
          <p className="mt-1 text-5xl font-bold tracking-tight tabular-nums">{inr(session.amount)}</p>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-lime opacity-70" />
              <span className="relative inline-flex size-3 rounded-full bg-lime" />
            </span>
            <span className="flex-1 font-semibold">
              {callStage === "ringing"
                ? t("session.ringing")
                : callStage === "waiting" && session.rail === "ivr123"
                  ? t("session.waitingCallback")
                  : session.phase === "awaitingSms"
                    ? t("session.awaiting")
                    : t("session.dialing")}
            </span>
            <span className="flex items-center gap-1 text-white/70 tabular-nums">
              <Clock3 size={14} /> {t("session.timer", { m: mm, s: ss })}
            </span>
          </div>
        </div>

        <Glass className="p-4">
          <ol className="space-y-3">
            {steps.map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-lime text-sm font-bold text-navy">{i + 1}</span>
                <span className="pt-0.5 font-medium">{t(k, { id: session.payeeId, amount: session.amount })}</span>
              </li>
            ))}
          </ol>
          {session.rail === "ussd" && (
            <button type="button" onClick={() => copyText(session.payeeId)} className="press mt-3 w-full rounded-2xl bg-sun px-4 py-3 text-left font-mono text-sm font-semibold text-navy">
              {session.payeeId} · {t("common.copy")}
            </button>
          )}
        </Glass>

        {!canDial && (
          <p className="rounded-2xl bg-sun/80 p-3 text-sm font-medium text-navy">
            {t("session.noDial")}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button tone="lime" size="md" onClick={() => opt?.href && openPaymentUri(opt.href, { simSlot: opt.simSlot, rail: opt.id, labels: overlayLabels(t, session.payeeLabel, session.amount) })} disabled={!opt?.href}>
            <PhoneCall size={18} /> {session.rail === "online" ? t("session.openApp") : t("session.callAgain")}
          </Button>
          <Button tone="glass" size="md" onClick={() => dispatch({ type: "CALL_ENDED", now: Date.now() })} disabled={session.phase !== "dialing"}>
            <PhoneOff size={18} /> {t("session.callEnded")}
          </Button>
        </div>

        {session.lastRejected && (
          <p role="status" className="rounded-2xl bg-danger/15 p-3 text-sm font-semibold text-danger">
            {t(`session.reject.${session.lastRejected}`, { amount: session.amount })}
          </p>
        )}

        <Glass className="p-4">
          <button type="button" onClick={() => setShowPaste(!showPaste)} className="flex w-full items-center gap-3 text-left font-semibold">
            <MessageSquareText size={20} /> {t("session.pasteSms")}
          </button>
          {showPaste && (
            <div className="mt-3 space-y-2">
              <textarea
                value={sms}
                onChange={(e) => setSms(e.target.value)}
                rows={4}
                placeholder={t("session.pasteSms.ph")}
                aria-label={t("session.pasteSms")}
                className="glass w-full rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-violet"
              />
              <Button size="md" className="w-full" disabled={!sms.trim()} onClick={() => submitSms(sms)}>
                {t("session.verify")}
              </Button>
            </div>
          )}
          {!isNativeApp() && <p className="mt-3 text-xs text-ink-soft">{t("session.autoNote")}</p>}
        </Glass>

        {(settings.demoTools || !canDial) && (
          <Button tone="lilac" size="md" className="w-full" onClick={() => submitSms(demoSmsBody(settings.bank, session.amount, session.payeeLabel))}>
            <Sparkles size={18} /> {t("session.demoSms")}
          </Button>
        )}
        <button type="button" onClick={() => dispatch({ type: "USER_CONFIRMED" })} className="w-full py-2 text-sm font-semibold text-ink-soft underline underline-offset-4">
          {t("session.iPaid")}
        </button>
      </div>
    </div>
  );
}

function Result({ session, onHome }: { session: Session; onHome: () => void }) {
  const t = useT();
  const map = {
    success: { Icon: CheckCircle2, tone: "bg-mint text-forest", title: "result.success" },
    failed: { Icon: XCircle, tone: "bg-danger/20 text-danger", title: "result.failed" },
    unverified: { Icon: ShieldAlert, tone: "bg-sun text-navy", title: "result.unverified", sub: "result.unverified.sub" },
    cancelled: { Icon: XCircle, tone: "bg-stone text-navy", title: "result.cancelled" },
    timeout: { Icon: Clock3, tone: "bg-sky text-navy", title: "result.timeout", sub: "result.timeout.sub" },
  } as const;
  const m = map[session.phase as keyof typeof map];
  const c = session.confirmation;
  const share = async () => {
    const text = `LiquidPay: ${inr(session.amount)} to ${session.payeeLabel}${c?.reference ? ` · Ref ${c.reference}` : ""} · ${t(m.title)}`;
    if (navigator.share) await navigator.share({ text }).catch(() => {});
    else await copyText(text);
  };
  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-16">
      <div className="flex-1 text-center">
        <span className={cx("mx-auto grid size-28 place-items-center rounded-[36px]", m.tone)}>
          <m.Icon size={56} />
        </span>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{t(m.title)}</h1>
        {"sub" in m && <p className="mx-auto mt-2 max-w-xs text-ink-soft">{t(m.sub)}</p>}
        <p className="mt-6 text-5xl font-bold tracking-tight tabular-nums">{inr(c?.amount ?? session.amount)}</p>
        <p className="mt-1 text-ink-soft">{c?.counterparty ?? session.payeeLabel}</p>
        {c && (
          <Glass className="mt-6 divide-y divide-white/40 p-2 text-left text-sm">
            <Row k={t("result.bank")} v={c.bankName} />
            {c.reference && <Row k={t("result.ref")} v={c.reference} mono />}
            <Row k={t("result.route")} v={session.rail === "ivr123" ? "UPI 123Pay" : session.rail === "ussd" ? "*99# USSD" : "UPI app"} />
          </Glass>
        )}
      </div>
      <div className="space-y-3">
        {(session.phase === "success" || session.phase === "unverified") && (
          <div className="grid grid-cols-2 gap-3">
            <Button tone="glass" size="md" onClick={share}>
              <Share2 size={18} /> {t("result.share")}
            </Button>
            <Link href={`/khata?name=${encodeURIComponent(session.payeeLabel)}&phone=${encodeURIComponent(session.payeeId)}&amount=${session.amount}`} className="press glass inline-flex h-11 items-center justify-center rounded-full font-semibold">
              {t("result.addKhata")}
            </Link>
          </div>
        )}
        <Button className="w-full" onClick={onHome}>
          {t("result.home")}
        </Button>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 px-3 py-2.5">
      <span className="text-ink-soft">{k}</span>
      <span className={cx("truncate font-semibold", mono && "font-mono")}>{v}</span>
    </div>
  );
}
