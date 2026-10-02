"use client";

// Platform layer. In the LiquidPay Android app (Capacitor) the native
// `LiquidPay` plugin places calls directly on the chosen SIM, mutes the IVR
// call under an overlay, reports call state and delivers bank SMS. In a
// browser we fall back to handing tel:/upi: URIs to the OS.

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

type Perm = "granted" | "denied" | "prompt" | "prompt-with-rationale";
export type NativePermission = "phone" | "sms" | "answer" | "camera";

export interface NativeSim {
  slot: number;
  carrierName: string;
  displayName: string;
  subscriptionId: number;
  mcc?: string;
  mnc?: string;
}

export interface OverlayLabels {
  title: string;
  payee: string;
  amount: string;
  note: string;
  endCall: string;
  openApp: string;
  statusCalling: string;
  statusWaiting: string;
  statusRinging: string;
  chooser: string;
}

export interface CallStateEvent {
  state: "offhook" | "ringing" | "idle";
  durationMs?: number;
  /** True when the outgoing payment call has just ended. */
  first?: boolean;
}

interface LiquidPayPlugin {
  checkPermissions(): Promise<Record<NativePermission, Perm>>;
  requestPermissions(opts?: { permissions: NativePermission[] }): Promise<Record<NativePermission, Perm>>;
  getSims(): Promise<{ sims: NativeSim[] }>;
  getOverlayPermission(): Promise<{ granted: boolean }>;
  openOverlaySettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  dial(opts: { href: string; simSlot?: number; rail: string; mute?: boolean; labels: Partial<OverlayLabels> }): Promise<{ simSelected: boolean; overlay: boolean }>;
  endCall(): Promise<{ ended: boolean }>;
  finishPayment(): Promise<void>;
  updateOverlay(opts: { status: string; banner: boolean }): Promise<void>;
  takePendingSms(): Promise<{ messages: { sender: string; body: string; at: number }[] }>;
  pickContact(): Promise<{ phone: string; name: string }>;
  openUri(opts: { href: string }): Promise<void>;
  addListener(event: "callState", cb: (e: CallStateEvent) => void): Promise<PluginListenerHandle>;
  addListener(event: "sms", cb: () => void): Promise<PluginListenerHandle>;
  addListener(event: "overlayAction", cb: (e: { action: string }) => void): Promise<PluginListenerHandle>;
}

export const LiquidPay = registerPlugin<LiquidPayPlugin>("LiquidPay");

export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

export function platform() {
  if (typeof navigator === "undefined") return { android: false, ios: false, mobile: false, native: false };
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPhone|iPad|iPod/i.test(ua);
  return { android, ios, mobile: android || ios, native: isNativeApp() };
}

export interface OpenOptions {
  simSlot?: 1 | 2;
  rail?: string;
  labels?: Partial<OverlayLabels>;
}

/** Open a tel: or upi: URI. Returns false when this device can't place it. */
export async function openPaymentUri(href: string, opts: OpenOptions = {}): Promise<boolean> {
  if (isNativeApp()) {
    try {
      if (href.startsWith("upi:")) await LiquidPay.openUri({ href });
      else await LiquidPay.dial({ href, simSlot: opts.simSlot, rail: opts.rail ?? "ivr123", mute: true, labels: opts.labels ?? {} });
      return true;
    } catch {
      return false;
    }
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
