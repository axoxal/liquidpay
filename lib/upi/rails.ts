// SPDX-License-Identifier: Apache-2.0
//
// Rail routing: given who we're paying, the user's SIMs and connectivity,
// decide which payment rails are possible and in what order.
//
//  - online  → upi:// intent (any payee, any amount ≤ ₹1L)
//  - ivr123  → UPI 123Pay call; needs a mobile-number payee + whole rupees ≤ cap.
//              Works on every carrier, including Jio (VoLTE).
//  - ussd    → *99#; needs a non-Jio SIM. Jio never carried USSD.
//  - queue   → save and remind when internet returns (last resort).

import { USSD_MAIN, USSD_PAY_VPA, MAX_AMOUNT, MIN_AMOUNT, UPI123PAY_DEFAULT_CAP } from "./constants";
import { build123PayDial, ussdHref, type IvrRejectReason } from "./dial";
import { buildUpiUri } from "./intent";
import { mobileFromVpa } from "./qr";

export type Carrier = "jio" | "airtel" | "vi" | "bsnl" | "other";
export interface Sim {
  slot: 1 | 2;
  carrier: Carrier;
}

export type RailId = "online" | "ivr123" | "ussd" | "queue";

export type PayTarget =
  | { kind: "mobile"; phone: string; name?: string }
  | { kind: "vpa"; vpa: string; name?: string; note?: string };

export interface RailOption {
  id: RailId;
  available: boolean;
  /** Why it's unavailable — an i18n key suffix, resolved at the UI edge. */
  blocker?: "NEED_INTERNET" | "JIO_NO_USSD" | "NO_MOBILE_PAYEE" | IvrRejectReason | "AMOUNT_RANGE";
  href?: string;
  /** For USSD: the SIM slot to use. */
  simSlot?: 1 | 2;
  /** USSD QR flow: the user pastes this VPA into the *99# menu. */
  copyText?: string;
}

export interface RouteInput {
  target: PayTarget;
  amount: string;
  sims: Sim[];
  online: boolean;
  ivrCap?: number;
  /** Dialer pauses between 123Pay digits. */
  ivrPauses?: number;
  ivrStartPauses?: number;
  ivrLangKey?: string;
  ivrGuided?: boolean;
}

export const supportsUssd = (c: Carrier) => c !== "jio";

export function routePayment({ target, amount, sims, online, ivrCap = UPI123PAY_DEFAULT_CAP, ivrPauses, ivrStartPauses, ivrLangKey, ivrGuided }: RouteInput): RailOption[] {
  const value = Number(amount);
  const amountOk = Number.isFinite(value) && value >= MIN_AMOUNT && value <= MAX_AMOUNT;
  const out: RailOption[] = [];

  // Online intent — only meaningful for a VPA payee or a mobile we can address as one.
  const vpa = target.kind === "vpa" ? target.vpa : null;
  if (vpa) {
    const href = amountOk ? buildUpiUri({ vpa, name: target.name, amount, note: target.kind === "vpa" ? target.note : undefined }) : null;
    out.push(
      !online
        ? { id: "online", available: false, blocker: "NEED_INTERNET" }
        : href
          ? { id: "online", available: true, href }
          : { id: "online", available: false, blocker: "AMOUNT_RANGE" },
    );
  }

  // 123Pay IVR
  const phone = target.kind === "mobile" ? target.phone : mobileFromVpa(target.vpa);
  if (!phone) {
    out.push({ id: "ivr123", available: false, blocker: "NO_MOBILE_PAYEE" });
  } else {
    const r = build123PayDial(phone, amount, { cap: ivrCap, pauses: ivrPauses, startPauses: ivrStartPauses, langKey: ivrLangKey, guided: ivrGuided });
    out.push(r.ok ? { id: "ivr123", available: true, href: r.href } : { id: "ivr123", available: false, blocker: r.reason });
  }

  // USSD *99#
  const ussdSim = sims.find((s) => supportsUssd(s.carrier));
  if (!ussdSim) {
    out.push({ id: "ussd", available: false, blocker: "JIO_NO_USSD" });
  } else if (!amountOk) {
    out.push({ id: "ussd", available: false, blocker: "AMOUNT_RANGE" });
  } else {
    out.push({
      id: "ussd",
      available: true,
      simSlot: ussdSim.slot,
      href: ussdHref(vpa ? USSD_PAY_VPA : USSD_MAIN),
      copyText: vpa ?? phone ?? undefined,
    });
  }

  // Offline queue is always possible as a fallback when we're offline.
  out.push({ id: "queue", available: !online && amountOk, blocker: online ? "NEED_INTERNET" : amountOk ? undefined : "AMOUNT_RANGE" });

  // Order: online first when online; otherwise IVR (works on all carriers), then USSD, then queue.
  const rank: Record<RailId, number> = online
    ? { online: 0, ivr123: 1, ussd: 2, queue: 3 }
    : { ivr123: 0, ussd: 1, online: 2, queue: 3 };
  return out.sort((a, b) => Number(b.available) - Number(a.available) || rank[a.id] - rank[b.id]);
}

/** The rail we'd pick for the user, if any. */
export const recommendedRail = (opts: RailOption[]) => opts.find((o) => o.available && o.id !== "queue") ?? null;
