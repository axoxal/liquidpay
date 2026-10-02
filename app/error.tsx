"use client";

import { useT } from "@/lib/i18n";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <LogoMark size={64} />
      <h1 className="text-2xl font-bold">{t("error.title")}</h1>
      <Button onClick={reset}>{t("error.retry")}</Button>
    </div>
  );
}
