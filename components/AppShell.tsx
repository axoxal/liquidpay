"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Home, ListOrdered, ScanLine, NotebookTabs, Wallet } from "lucide-react";
import { useApp } from "@/lib/store";
import { useHydrated } from "@/lib/hooks";
import { useT } from "@/lib/i18n";
import { LogoMark } from "./Logo";
import { cx } from "./ui";

const NAV = [
  { href: "/", key: "nav.home", Icon: Home },
  { href: "/activity", key: "nav.activity", Icon: ListOrdered },
  { href: "/scan", key: "nav.scan", Icon: ScanLine, center: true },
  { href: "/khata", key: "nav.khata", Icon: NotebookTabs },
  { href: "/wallet", key: "nav.wallet", Icon: Wallet },
] as const;

const NO_NAV = ["/onboarding", "/scan", "/session", "/pay"];

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const settings = useApp((s) => s.settings);
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  // Theme, lite mode and language live on <html> so CSS and screen readers see them.
  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    el.dataset.theme = settings.theme;
    el.dataset.lite = String(settings.lite);
    el.lang = settings.lang;
  }, [hydrated, settings.theme, settings.lite, settings.lang]);

  useEffect(() => {
    if (hydrated && !settings.onboarded && pathname !== "/onboarding") router.replace("/onboarding");
  }, [hydrated, settings.onboarded, pathname, router]);

  const showNav = hydrated && settings.onboarded && !NO_NAV.some((p) => pathname.startsWith(p));

  return (
    <>
      <div className="blobs" aria-hidden>
        <span style={{ width: 340, height: 340, left: -90, top: -60, background: "var(--mint)" }} />
        <span style={{ width: 300, height: 300, right: -80, top: 220, background: "var(--lilac)", animationDelay: "-6s" }} />
        <span style={{ width: 260, height: 260, left: 20, bottom: -40, background: "var(--sun)", opacity: 0.45, animationDelay: "-12s" }} />
      </div>
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[460px] flex-col">
        {hydrated ? (
          <main className={cx("flex-1", showNav && "pb-32")}>{children}</main>
        ) : (
          <div className="grid flex-1 place-items-center">
            <LogoMark size={72} className="animate-pulse" />
          </div>
        )}
        {showNav && (
          <nav
            aria-label="Main"
            className="glass fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),14px)] z-30 mx-auto flex w-[min(440px,calc(100%-24px))] items-center justify-between rounded-full px-3 py-2"
          >
            {NAV.map(({ href, key, Icon, ...rest }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              if ("center" in rest)
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={t(key)}
                    className="press -mt-8 grid size-16 place-items-center rounded-full border-4 border-mint bg-navy text-lime shadow-xl"
                  >
                    <Icon size={28} />
                  </Link>
                );
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "press flex w-16 flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] font-semibold",
                    active ? "text-ink" : "text-ink-soft/70",
                  )}
                >
                  <Icon size={22} strokeWidth={active ? 2.6 : 2} />
                  {t(key)}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}
