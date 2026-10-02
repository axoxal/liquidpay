"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Layers, MessageSquareLock, PhoneCall, PhoneOff } from "lucide-react";
import { LiquidPay, type NativeSim } from "@/lib/native";
import { useT, type MessageKey } from "@/lib/i18n";
import { Button, Glass, cx } from "./ui";

type Status = { phone: boolean; sms: boolean; answer: boolean; camera: boolean; overlay: boolean };

const ROWS: { key: keyof Status; label: MessageKey; Icon: typeof PhoneCall }[] = [
  { key: "phone", label: "onb.perm.phone", Icon: PhoneCall },
  { key: "sms", label: "onb.perm.sms", Icon: MessageSquareLock },
  { key: "answer", label: "onb.perm.answer", Icon: PhoneOff },
  { key: "overlay", label: "onb.perm.overlay", Icon: Layers },
  { key: "camera", label: "onb.perm.camera", Icon: Camera },
];

/** Native-only: explains and requests the Android permissions payments need. */
export function PermissionsPanel({ onSims }: { onSims?: (sims: NativeSim[]) => void }) {
  const t = useT();
  const [s, setS] = useState<Status | null>(null);

  const refresh = useCallback(async () => {
    const [p, o] = await Promise.all([LiquidPay.checkPermissions(), LiquidPay.getOverlayPermission()]);
    const next = { phone: p.phone === "granted", sms: p.sms === "granted", answer: p.answer === "granted", camera: p.camera === "granted", overlay: o.granted };
    setS(next);
    if (next.phone && onSims) onSims((await LiquidPay.getSims()).sims);
  }, [onSims]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    // Returning from the system overlay screen.
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const request = async () => {
    await LiquidPay.requestPermissions({ permissions: ["phone", "sms", "answer", "camera"] }).catch(() => {});
    await refresh();
  };

  const runtimeDone = s && s.phone && s.sms && s.answer && s.camera;

  return (
    <Glass className="p-4">
      <p className="font-bold">{t("onb.perm.title")}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("onb.perm.body")}</p>
      <ul className="mt-3 space-y-2">
        {ROWS.map(({ key, label, Icon }) => (
          <li key={key} className="flex items-center gap-3 text-sm">
            <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl text-navy", s?.[key] ? "bg-mint" : "bg-white/60")}>
              {s?.[key] ? <Check size={18} /> : <Icon size={18} />}
            </span>
            <span className="font-medium">{t(label)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-2">
        {!runtimeDone && (
          <Button size="md" className="w-full" onClick={request}>
            {t("onb.perm.allow")}
          </Button>
        )}
        {s && !s.overlay && (
          <Button size="md" tone="lilac" className="w-full" onClick={() => LiquidPay.openOverlaySettings()}>
            {t("onb.perm.overlayBtn")}
          </Button>
        )}
        {s && s.phone && !s.sms && (
          <button type="button" onClick={() => LiquidPay.openAppSettings()} className="w-full text-left text-xs font-semibold text-ink-soft underline">
            {t("onb.perm.restricted")}
          </button>
        )}
      </div>
    </Glass>
  );
}
