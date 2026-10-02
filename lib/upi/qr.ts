// SPDX-License-Identifier: Apache-2.0
// Ported from Flowpay QRCodeParser.kt (Apache-2.0). See NOTICE.

import { MAX_AMOUNT, PHONE_REGEX, VPA_REGEX } from "./constants";

export interface UpiPayee {
  vpa: string;
  payeeName: string;
  amount: string; // "" when the QR carries no amount
  note: string;
  currency: "INR";
}

export type QrRejectReason =
  | "EMPTY"
  | "NOT_A_UPI_QR"
  | "MALFORMED"
  | "NO_PAYEE_ADDRESS"
  | "INVALID_PAYEE_ADDRESS"
  | "INVALID_AMOUNT";

export type QrParseResult =
  | { ok: true; payee: UpiPayee }
  | { ok: false; reason: QrRejectReason };

const AMOUNT_SHAPE = /^[0-9]+(\.[0-9]{1,2})?$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

/**
 * Strict UPI QR parser. Accepts exactly a `upi://` URI with a valid `pa`, or a
 * bare VPA. Anything else is rejected with a reason rather than guessed at.
 */
export function parseUpiQr(input: string): QrParseResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: false, reason: "EMPTY" };

  if (/^upi:\/\//i.test(raw)) return parseUpiUri(raw);
  if (VPA_REGEX.test(raw)) {
    return { ok: true, payee: { vpa: raw, payeeName: "", amount: "", note: "", currency: "INR" } };
  }
  return { ok: false, reason: "NOT_A_UPI_QR" };
}

function parseUpiUri(raw: string): QrParseResult {
  const q = raw.indexOf("?");
  if (q < 0) return { ok: false, reason: "NO_PAYEE_ADDRESS" };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw.slice(q + 1));
  } catch {
    return { ok: false, reason: "MALFORMED" };
  }

  const vpa = (params.get("pa") ?? "").trim();
  if (!vpa) return { ok: false, reason: "NO_PAYEE_ADDRESS" };
  if (!VPA_REGEX.test(vpa)) return { ok: false, reason: "INVALID_PAYEE_ADDRESS" };

  const amount = (params.get("am") ?? "").trim();
  if (amount) {
    const value = Number(amount);
    if (!AMOUNT_SHAPE.test(amount) || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
      return { ok: false, reason: "INVALID_AMOUNT" };
    }
  }

  const payeeName = (params.get("pn") ?? "").trim().replace(CONTROL_CHARS, "").slice(0, 99);
  const note = (params.get("tn") ?? "").trim().replace(CONTROL_CHARS, "").slice(0, 99);

  return { ok: true, payee: { vpa, payeeName, amount, note, currency: "INR" } };
}

/**
 * If a VPA's local part is a 10-digit Indian mobile (e.g. `9876543210@ybl`),
 * return it. These payees can be paid over 123Pay IVR, which is how Jio users
 * pay QR codes without USSD.
 */
export function mobileFromVpa(vpa: string): string | null {
  const local = vpa.split("@")[0] ?? "";
  const digits = local.replace(/^(\+?91)/, "");
  return PHONE_REGEX.test(digits) ? digits : null;
}
