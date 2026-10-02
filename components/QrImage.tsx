"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrImage({ value, size = 240, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#13212F", light: "#FFFFFF" } }).then(
      (url) => live && setSrc(url),
    );
    return () => {
      live = false;
    };
  }, [value, size]);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} width={size} height={size} alt={label} className="rounded-2xl" />
  ) : (
    <div style={{ width: size, height: size }} className="animate-pulse rounded-2xl bg-white/60" />
  );
}
