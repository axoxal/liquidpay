"use client";

import { useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Download, Package } from "lucide-react";
import { useApp } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { buildUpiUri } from "@/lib/upi/intent";
import { copyText } from "@/lib/native";
import { QrImage } from "@/components/QrImage";
import { Button, Field, Header, inputCls } from "@/components/ui";
import { LogoMark } from "@/components/Logo";

export default function Receive() {
  const t = useT();
  const { settings } = useApp();
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const uri = settings.upiId ? buildUpiUri({ vpa: settings.upiId, name: settings.name, amount: amount || undefined }) : null;

  const download = async () => {
    if (!uri) return;
    const url = await QRCode.toDataURL(uri, { width: 1024, margin: 2, color: { dark: "#13212F", light: "#FFFFFF" } });
    const a = document.createElement("a");
    a.href = url;
    a.download = `liquidpay-${settings.upiId}.png`;
    a.click();
  };

  return (
    <div className="pb-8">
      <Header title={t("receive.title")} />
      <div className="space-y-4 px-5">
        {!settings.upiId ? (
          <div className="tile bg-sun p-6 text-navy">
            <p className="text-lg font-bold">{t("receive.needUpi")}</p>
            <Link href="/settings" className="press mt-4 inline-flex h-11 items-center rounded-full bg-navy px-5 font-semibold text-white">
              {t("settings.profile")}
            </Link>
          </div>
        ) : (
          <>
            <div className="tile mx-auto flex max-w-[320px] flex-col items-center bg-navy p-6 text-white">
              <div className="mb-4 flex items-center gap-2 font-semibold">
                <LogoMark size={26} /> {settings.name || "LiquidPay"}
              </div>
              <div className="rounded-3xl bg-white p-3">{uri && <QrImage value={uri} size={220} label={`UPI QR for ${settings.upiId}`} />}</div>
              <p className="mt-4 font-mono text-sm text-mint">{settings.upiId}</p>
              {amount && <p className="mt-1 text-2xl font-bold">₹{Number(amount).toLocaleString("en-IN")}</p>}
              <p className="mt-2 text-center text-xs text-white/60">{t("receive.sub")}</p>
            </div>
            <Field label={t("receive.amount")}>
              <input className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" placeholder="₹" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Button tone="mint" size="md" onClick={async () => setCopied(await copyText(settings.upiId))}>
                <Copy size={18} /> {copied ? t("common.copied") : t("common.copy")}
              </Button>
              <Button tone="lime" size="md" onClick={download}>
                <Download size={18} /> {t("receive.download")}
              </Button>
            </div>
            <Link href="/pro" className="tile press flex items-center gap-3 bg-olive p-4 text-white">
              <Package size={22} /> <span className="font-semibold">{t("receive.stand")}</span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
