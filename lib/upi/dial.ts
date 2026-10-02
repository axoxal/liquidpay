// SPDX-License-Identifier: Apache-2.0
// 123Pay builder ported from Flowpay Upi123CallStringBuilder.kt (Apache-2.0). See NOTICE.

import {
  MIN_AMOUNT,
  PHONE_REGEX,
  UPI123PAY_DEFAULT_CAP,
  UPI123PAY_SERVICE_NUMBER,
} from "./constants";

export type IvrRejectReason =
  | "SERVICE_NUMBER"
  | "RECIPIENT_NUMBER"
  | "AMOUNT_NOT_WHOLE_RUPEES"
  | "AMOUNT_BELOW_MINIMUM"
  | "AMOUNT_ABOVE_CAP";

export type IvrResult = { ok: true; href: string } | { ok: false; reason: IvrRejectReason };

const SERVICE_REGEX = /^0?[1-9][0-9]{9,11}$/;
const WHOLE_RUPEES = /^[0-9]{1,6}$/;

/** Strip +91 / 0 prefixes and non-digits from a user-typed mobile number. */
export function normalizeMobile(input: string): string {
  let d = (input ?? "").replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/**
 * Builds the UPI 123Pay IVR dial URI.
 *
 * Format: tel:<service>,,1,<phone>,,<amount>,,1 — "," is a 2-second dialer
 * pause; digits between pauses are DTMF consumed by the IVR (1 = send money,
 * recipient, amount, 1 = confirm). The UPI PIN is entered by the user on the
 * call — this app never sees it.
 */
export function build123PayDial(
  phoneNumber: string,
  amount: string,
  opts: { cap?: number; serviceNumber?: string; pauses?: number } = {},
): IvrResult {
  const service = (opts.serviceNumber ?? UPI123PAY_SERVICE_NUMBER).replace(/\D/g, "");
  const cap = opts.cap ?? UPI123PAY_DEFAULT_CAP;
  const phone = normalizeMobile(phoneNumber);
  const rupees = (amount ?? "").trim();

  if (!SERVICE_REGEX.test(service)) return { ok: false, reason: "SERVICE_NUMBER" };
  if (!PHONE_REGEX.test(phone)) return { ok: false, reason: "RECIPIENT_NUMBER" };
  if (!WHOLE_RUPEES.test(rupees)) return { ok: false, reason: "AMOUNT_NOT_WHOLE_RUPEES" };
  const value = Number(rupees);
  if (value < MIN_AMOUNT) return { ok: false, reason: "AMOUNT_BELOW_MINIMUM" };
  if (value > cap) return { ok: false, reason: "AMOUNT_ABOVE_CAP" };

  // Each "," is ~2 s. Slower IVRs drop digits sent before the prompt finishes,
  // so the gap is configurable (default 2 = Flowpay's field-tested string).
  const n = Math.min(6, Math.max(1, Math.round(opts.pauses ?? 2)));
  const gap = ",".repeat(n);
  return { ok: true, href: `tel:${service}${gap}1,${phone}${gap}${value}${gap}1` };
}

/** `tel:` URI for a USSD code. `#` must be percent-encoded or dialers truncate at it. */
export function ussdHref(code: string): string {
  return `tel:${encodeURIComponent(code)}`;
}
