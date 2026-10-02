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
  opts: {
    cap?: number;
    serviceNumber?: string;
    /** Pauses (~2 s each) between steps. */
    pauses?: number;
    /** Pauses before the first key, to let the welcome message finish. */
    startPauses?: number;
    /** Key for the IVR's language menu, if it asks one first ("" = none). */
    langKey?: string;
    /**
     * Guided: use ";" (dialer WAIT) instead of timed pauses. The phone's dialer
     * then shows "Send tones?" at each step and the user taps it when the
     * voice asks — the digits are still pre-filled. Works when timing doesn't.
     */
    guided?: boolean;
  } = {},
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
  const clamp = (v: number) => Math.min(8, Math.max(1, Math.round(v)));
  const n = clamp(opts.pauses ?? 2);
  const gap = opts.guided ? ";" : ",".repeat(n);
  const start = opts.guided ? ";" : ",".repeat(clamp(opts.startPauses ?? n));
  const lang = /^[0-9]$/.test(opts.langKey ?? "") ? opts.langKey! : "";
  const steps = [...(lang ? [lang] : []), "1", phone, String(value), "1"];
  // Legacy timed string kept byte-identical: "1" directly after a single ","
  // following the start gap (tel:SVC,,1,PHONE,,AMT,,1).
  if (!opts.guided && !lang && opts.startPauses === undefined) {
    return { ok: true, href: `tel:${service}${gap}1,${phone}${gap}${value}${gap}1` };
  }
  return { ok: true, href: `tel:${service}${start}${steps.join(gap)}` };
}

/** `tel:` URI for a USSD code. `#` must be percent-encoded or dialers truncate at it. */
export function ussdHref(code: string): string {
  return `tel:${encodeURIComponent(code)}`;
}
