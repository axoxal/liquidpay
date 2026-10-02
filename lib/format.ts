/** Indian digit grouping: 100000 → "1,00,000". */
export function inr(amount: number | string, opts: { decimals?: boolean } = {}) {
  const n = typeof amount === "string" ? Number(amount.replace(/,/g, "")) : amount;
  if (!Number.isFinite(n)) return "₹0";
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  return (
    "₹" +
    n.toLocaleString("en-IN", {
      minimumFractionDigits: opts.decimals || hasPaise ? 2 : 0,
      maximumFractionDigits: 2,
    })
  );
}

export function timeAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "?";

export const maskMobile = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);
