// SPDX-License-Identifier: Apache-2.0
//
// Payment session state machine (pure reducer), modelled on Flowpay's
// PaymentSessionManager. The invariant: a payment is only marked SUCCESS by a
// confirming bank SMS whose amount matches — never by call state or by the
// user tapping a button. A user's own "I paid" is recorded as UNVERIFIED.

import { VERIFICATION_DEADLINE_MS } from "./constants";
import { parseBankSms, type ParsedSms } from "./sms";
import type { RailId } from "./rails";

export type SessionPhase =
  | "ready"        // rail chosen, nothing dialed yet
  | "dialing"      // handed to dialer / UPI app
  | "awaitingSms"  // waiting for bank confirmation
  | "success"
  | "failed"
  | "unverified"   // user says they paid; no bank SMS confirmed it
  | "cancelled"
  | "timeout";

export interface Session {
  id: string;
  rail: RailId;
  amount: string;
  payeeLabel: string;
  payeeId: string; // phone or VPA
  phase: SessionPhase;
  startedAt: number;
  deadline: number | null;
  confirmation: ParsedSms | null;
  /** Last SMS we looked at but rejected (wrong amount / not a bank SMS). */
  lastRejected: "NOT_BANK_TXN" | "AMOUNT_MISMATCH" | null;
}

export type SessionEvent =
  | { type: "DIAL"; now: number }
  | { type: "CALL_ENDED"; now: number; durationMs?: number }
  | { type: "SMS"; sender: string; body: string; now: number }
  | { type: "USER_CONFIRMED" }
  | { type: "CANCEL" }
  | { type: "TICK"; now: number };

export const TERMINAL: SessionPhase[] = ["success", "failed", "unverified", "cancelled", "timeout"];
export const isTerminal = (p: SessionPhase) => TERMINAL.includes(p);

export function createSession(input: Pick<Session, "id" | "rail" | "amount" | "payeeLabel" | "payeeId">, now: number): Session {
  return { ...input, phase: "ready", startedAt: now, deadline: null, confirmation: null, lastRejected: null };
}

/** Calls shorter than this never connected to the IVR — treated as cancelled. */
export const SHORT_CALL_MS = 5000;

export function reduceSession(s: Session, e: SessionEvent): Session {
  if (isTerminal(s.phase)) return s;

  switch (e.type) {
    case "DIAL":
      if (s.phase !== "ready") return s;
      return { ...s, phase: "dialing", deadline: e.now + VERIFICATION_DEADLINE_MS };

    case "CALL_ENDED":
      if (s.phase !== "dialing") return s;
      if (e.durationMs !== undefined && e.durationMs < SHORT_CALL_MS) return { ...s, phase: "cancelled" };
      return { ...s, phase: "awaitingSms" };

    case "SMS": {
      if (s.phase !== "dialing" && s.phase !== "awaitingSms") return s;
      // Detect "it's a bank txn, but the wrong amount" separately so the UI can say so.
      const anyAmount = parseBankSms(e.sender, e.body, { clock: () => e.now });
      if (!anyAmount) return { ...s, lastRejected: "NOT_BANK_TXN" };
      const parsed = parseBankSms(e.sender, e.body, { expectedAmount: s.amount, clock: () => e.now });
      if (!parsed || parsed.direction === "CREDIT") return { ...s, lastRejected: "AMOUNT_MISMATCH" };
      return { ...s, phase: parsed.status === "SUCCESS" ? "success" : "failed", confirmation: parsed, lastRejected: null };
    }

    case "USER_CONFIRMED":
      if (s.phase !== "dialing" && s.phase !== "awaitingSms") return s;
      return { ...s, phase: "unverified" };

    case "CANCEL":
      return { ...s, phase: "cancelled" };

    case "TICK":
      if (s.deadline !== null && e.now >= s.deadline) return { ...s, phase: "timeout" };
      return s;
  }
}
