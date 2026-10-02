// SPDX-License-Identifier: Apache-2.0
import { MAX_AMOUNT, VPA_REGEX } from "./constants";

export interface UpiIntentInput {
  vpa: string;
  name?: string;
  amount?: string;
  note?: string;
}

/**
 * NPCI `upi://pay` deep link. On Android this opens the user's UPI app chooser
 * (GPay, PhonePe, BHIM…). Used for the online rail and for receive-QR codes.
 * Returns null for an invalid VPA or amount so callers can't emit a bad link.
 */
export function buildUpiUri({ vpa, name, amount, note }: UpiIntentInput): string | null {
  const pa = vpa.trim();
  if (!VPA_REGEX.test(pa)) return null;
  const params = new URLSearchParams({ pa });
  if (name?.trim()) params.set("pn", name.trim().slice(0, 99));
  if (amount?.trim()) {
    const v = Number(amount);
    if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(amount.trim()) || v <= 0 || v > MAX_AMOUNT) return null;
    params.set("am", v.toFixed(2));
  }
  params.set("cu", "INR");
  if (note?.trim()) params.set("tn", note.trim().slice(0, 50));
  // URLSearchParams encodes spaces as "+", which several UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}
