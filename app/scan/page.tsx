"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { ClipboardPaste, ImageUp, Sparkles, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { parseUpiQr, type QrRejectReason } from "@/lib/upi/qr";
import { Button, cx, inputCls } from "@/components/ui";

const DEMO_QRS = [
  { label: "Kirana (phone UPI)", raw: "upi://pay?pa=9876543210@ybl&pn=Sharma%20Kirana&cu=INR" },
  { label: "Café (merchant UPI)", raw: "upi://pay?pa=bluecafe@okaxis&pn=Blue%20Cafe&am=180&tn=Coffee&cu=INR" },
];

export default function ScanPage() {
  const t = useT();
  const router = useRouter();
  const sims = useApp((s) => s.settings.sims);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camError, setCamError] = useState(false);
  const [reason, setReason] = useState<QrRejectReason | null>(null);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const handled = useRef(false);

  const handle = useCallback(
    (raw: string) => {
      if (handled.current) return;
      const r = parseUpiQr(raw);
      if (!r.ok) {
        setReason(r.reason);
        return;
      }
      handled.current = true;
      navigator.vibrate?.(40);
      const p = new URLSearchParams({ vpa: r.payee.vpa });
      if (r.payee.payeeName) p.set("pn", r.payee.payeeName);
      if (r.payee.amount) p.set("am", r.payee.amount);
      if (r.payee.note) p.set("tn", r.payee.note);
      router.replace(`/pay?${p}`);
    },
    [router],
  );

  const decodeCanvas = useCallback((w: number, h: number) => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const img = ctx.getImageData(0, 0, w, h);
    return jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" })?.data ?? null;
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (stopped) return stream.getTracks().forEach((tr) => tr.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = () => {
          if (stopped) return;
          const c = canvasRef.current;
          if (c && v.videoWidth) {
            const scale = Math.min(1, 640 / v.videoWidth);
            c.width = Math.round(v.videoWidth * scale);
            c.height = Math.round(v.videoHeight * scale);
            c.getContext("2d", { willReadFrequently: true })!.drawImage(v, 0, 0, c.width, c.height);
            const data = decodeCanvas(c.width, c.height);
            if (data) handle(data);
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setCamError(true);
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [decodeCanvas, handle]);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const bmp = await createImageBitmap(f);
    const c = canvasRef.current!;
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d", { willReadFrequently: true })!.drawImage(bmp, 0, 0, c.width, c.height);
    const data = decodeCanvas(c.width, c.height);
    if (data) handle(data);
    else setReason("NOT_A_UPI_QR");
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-navy text-white">
      <video ref={videoRef} playsInline muted className={cx("absolute inset-0 size-full object-cover", camError && "hidden")} />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy/70 via-transparent to-navy/90" />

      <div className="relative flex items-center justify-between px-5 pt-[max(env(safe-area-inset-top),16px)]">
        <h1 className="text-2xl font-bold">{t("scan.title")}</h1>
        <button type="button" aria-label={t("common.back")} onClick={() => router.back()} className="press grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur">
          <X size={22} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-10">
        <div className="relative aspect-square w-full max-w-[280px] rounded-[36px] border-4 border-mint/90 shadow-[0_0_0_9999px_rgba(19,33,47,0.35)]">
          <span className="scan-line absolute inset-x-4 h-1 rounded-full bg-lime shadow-[0_0_16px_#e4f78a]" />
        </div>
        <p className="mt-6 text-center font-medium text-white/80">{camError ? t("scan.noCamera") : t("scan.hint")}</p>
        {reason && (
          <p role="alert" className="mt-3 rounded-full bg-danger px-4 py-2 text-sm font-semibold">
            {t(`scan.reason.${reason}`)}
          </p>
        )}
      </div>

      <div className="relative space-y-3 px-5 pb-[max(env(safe-area-inset-bottom),20px)]">
        {sims.some((s) => s.carrier === "jio") && <p className="rounded-2xl bg-sky/90 p-3 text-xs font-medium text-navy">{t("scan.jioNote")}</p>}
        {showPaste && (
          <div className="flex gap-2">
            <input value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="upi://pay?pa=…" className={cx(inputCls, "h-12 text-base")} aria-label={t("scan.paste")} autoFocus />
            <Button tone="lime" size="md" onClick={() => handle(paste)}>
              OK
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button tone="mint" size="md" onClick={() => fileRef.current?.click()}>
            <ImageUp size={18} /> {t("scan.gallery")}
          </Button>
          <Button tone="lilac" size="md" onClick={() => setShowPaste(!showPaste)}>
            <ClipboardPaste size={18} /> {t("scan.paste")}
          </Button>
        </div>
        <div className="flex gap-2">
          {DEMO_QRS.map((d) => (
            <button key={d.label} type="button" onClick={() => handle(d.raw)} className="press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold backdrop-blur">
              <Sparkles size={14} /> {d.label}
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  );
}
