"use client";

import { Check, Clock, PhoneCall, Smartphone, Hash } from "lucide-react";
import type { RailId, RailOption } from "@/lib/upi/rails";
import { useT, type MessageKey } from "@/lib/i18n";
import { cx } from "./ui";

const META: Record<RailId, { Icon: typeof PhoneCall; tone: string }> = {
  online: { Icon: Smartphone, tone: "bg-lilac" },
  ivr123: { Icon: PhoneCall, tone: "bg-lime" },
  ussd: { Icon: Hash, tone: "bg-sun" },
  queue: { Icon: Clock, tone: "bg-sky" },
};

export function RailPicker({
  options,
  value,
  onChange,
  ivrCap,
}: {
  options: RailOption[];
  value: RailId | null;
  onChange: (id: RailId) => void;
  ivrCap: number;
}) {
  const t = useT();
  const firstLive = options.find((o) => o.available && o.id !== "queue")?.id;
  return (
    <div role="radiogroup" aria-label={t("pay.routes")} className="space-y-2">
      {options.map((o) => {
        const { Icon, tone } = META[o.id];
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={!o.available}
            disabled={!o.available}
            onClick={() => onChange(o.id)}
            className={cx(
              "press flex w-full items-center gap-3 rounded-3xl p-3 text-left",
              selected ? "bg-navy text-white" : "glass",
              !o.available && "opacity-55",
            )}
          >
            <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl text-navy", tone)}>
              <Icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-bold">
                {t(`rail.${o.id}` as MessageKey)}
                {o.id === firstLive && (
                  <span className={cx("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", selected ? "bg-lime text-navy" : "bg-navy text-lime")}>
                    {t("pay.recommended")}
                  </span>
                )}
              </span>
              <span className={cx("block truncate text-xs", selected ? "text-white/70" : "text-ink-soft")}>
                {o.available
                  ? t(`rail.${o.id}.sub` as MessageKey, { slot: o.simSlot ?? 1 })
                  : t(`blocker.${o.blocker}` as MessageKey, { cap: ivrCap.toLocaleString("en-IN") })}
              </span>
            </span>
            {selected && <Check size={20} className="text-lime" />}
          </button>
        );
      })}
    </div>
  );
}
