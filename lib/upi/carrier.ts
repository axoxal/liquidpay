import type { Carrier } from "./rails";

// Jio's Indian MNCs under MCC 405 (840, 854–874).
const JIO_MNC = new Set(["840", ...Array.from({ length: 21 }, (_, i) => String(854 + i))]);

/** Map a SIM's carrier name (and MCC/MNC when available) to a routing carrier. */
export function detectCarrier(name: string, mcc?: string, mnc?: string): Carrier {
  const n = (name ?? "").toLowerCase();
  if (/\bjio\b|reliance jio/.test(n)) return "jio";
  if (/airtel/.test(n)) return "airtel";
  if (/\bvi\b|vodafone|idea|\bvi india/.test(n)) return "vi";
  if (/bsnl|cellone|mtnl/.test(n)) return "bsnl";
  if (mcc === "405" && mnc && JIO_MNC.has(mnc)) return "jio";
  return "other";
}
