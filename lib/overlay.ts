import type { TFn } from "./i18n";
import type { OverlayLabels } from "./native";
import { inr } from "./format";

/** Localised strings for the native call overlay. */
export function overlayLabels(t: TFn, payee: string, amount: string): OverlayLabels {
  return {
    title: "LiquidPay",
    payee,
    amount: inr(amount),
    note: t("overlay.note"),
    endCall: t("overlay.endCall"),
    openApp: t("overlay.openApp"),
    statusCalling: t("overlay.calling"),
    statusWaiting: t("overlay.waiting"),
    statusRinging: t("overlay.ringing"),
    chooser: t("overlay.chooser"),
    answerCall: t("overlay.answer"),
    statusAnswered: t("overlay.answered"),
  };
}
