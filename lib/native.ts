"use client";

// Thin platform layer. In the browser we hand tel:/upi: URIs to the OS. In the
// Capacitor Android build (Phase 2) a native plugin registered as
// `window.LiquidPayNative` takes over: it places ACTION_CALL with the right SIM,
// reports call state, and streams incoming bank SMS — the same contract Flowpay's
// CallManager / SimpleSMSReceiver implement in Kotlin.

export interface NativeBridge {
  dial(href: string, simSlot?: 1 | 2): Promise<void>;
  onCallEnded(cb: (durationMs: number) => void): () => void;
  onSms(cb: (sender: string, body: string) => void): () => void;
}

declare global {
  interface Window {
    LiquidPayNative?: NativeBridge;
  }
}

export const native = (): NativeBridge | null => (typeof window !== "undefined" ? window.LiquidPayNative ?? null : null);

export function platform() {
  if (typeof navigator === "undefined") return { android: false, ios: false, mobile: false };
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  return { android, ios, mobile: android || ios };
}

/** Open a tel: or upi: URI. Returns false when this device can't place it. */
export async function openPaymentUri(href: string, simSlot?: 1 | 2): Promise<boolean> {
  const bridge = native();
  if (bridge) {
    await bridge.dial(href, simSlot);
    return true;
  }
  const p = platform();
  // Desktops can't place these calls; navigating would only pop an
  // "open FaceTime?"-style dialog. The session screen explains instead.
  if (!p.mobile) return false;
  // iOS blocks USSD (`*`/`#`) from web and apps; upi:// needs Android.
  if (p.ios && (href.includes("%23") || href.includes("*"))) return false;
  if (href.startsWith("upi:") && !p.android) return false;
  window.location.assign(href);
  return true;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
