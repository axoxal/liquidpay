"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Glass({ className, children, as: As = "div" }: { className?: string; children: ReactNode; as?: "div" | "section" }) {
  return <As className={cx("glass rounded-[28px]", className)}>{children}</As>;
}

type Tone = "ink" | "lime" | "mint" | "forest" | "sun" | "lilac" | "sky" | "olive" | "glass" | "danger";
const toneClass: Record<Tone, string> = {
  ink: "bg-navy text-white",
  lime: "bg-lime text-navy",
  mint: "bg-mint text-navy",
  forest: "bg-forest text-forest-ink",
  sun: "bg-sun text-navy",
  lilac: "bg-lilac text-navy",
  sky: "bg-sky text-navy",
  olive: "bg-olive text-white",
  glass: "glass text-ink",
  danger: "bg-danger text-white",
};

export function Button({
  tone = "ink",
  size = "lg",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "md" | "lg" }) {
  return (
    <button
      {...rest}
      className={cx(
        "press inline-flex items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-40 disabled:pointer-events-none",
        size === "lg" ? "h-14 px-6 text-[17px]" : "h-11 px-4 text-[15px]",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tile({
  tone,
  href,
  onClick,
  className,
  children,
}: {
  tone: Tone;
  href?: string;
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const cls = cx("tile press block text-left", toneClass[tone], className);
  if (href)
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

export function IconBadge({ children, tone = "glass", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("inline-grid size-11 place-items-center rounded-2xl", toneClass[tone], className)} aria-hidden>
      {children}
    </span>
  );
}

export function Pill({ children, tone = "glass", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function Header({ title, back = true, right }: { title: string; back?: boolean | string; right?: ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 px-5 pb-3 pt-[max(env(safe-area-inset-top),16px)]">
      {back && (
        <button
          type="button"
          aria-label="Back"
          onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
          className="press glass grid size-11 place-items-center rounded-full"
        >
          <ArrowLeft size={20} />
        </button>
      )}
      <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">{title}</h1>
      {right}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span role="alert" className="mt-1.5 block text-sm font-medium text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputCls =
  "glass h-14 w-full rounded-2xl px-4 text-lg font-medium text-ink placeholder:text-ink-soft/60 outline-none focus:ring-2 focus:ring-violet";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="glass flex rounded-full p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            "press flex-1 rounded-full px-3 py-2 text-sm font-semibold",
            value === o.id ? "bg-navy text-white" : "text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx("relative h-8 w-14 shrink-0 rounded-full transition-colors", checked ? "bg-forest" : "bg-stone")}
    >
      <span className={cx("absolute top-1 size-6 rounded-full bg-white shadow transition-all", checked ? "left-7" : "left-1")} />
    </button>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
