// LiquidPay mark — an original rounded asterisk ("six ways to pay") in navy on
// lime. Inspired by the moodboard's palette; not a copy of any third-party logo.

export function LogoMark({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="LiquidPay">
      <rect width="64" height="64" rx="18" fill="#E4F78A" />
      <g transform="translate(32 32)" fill="#13212F">
        {[0, 60, 120].map((r) => (
          <rect key={r} x="-5.5" y="-21" width="11" height="42" rx="5.5" transform={`rotate(${r})`} />
        ))}
      </g>
      <circle cx="32" cy="32" r="4.5" fill="#E4F78A" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <LogoMark size={28} />
      <span>
        Liquid<span className="opacity-60">Pay</span>
      </span>
    </span>
  );
}
