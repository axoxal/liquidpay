import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 px-8 text-center">
      <LogoMark size={64} />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="press inline-flex h-14 items-center rounded-full bg-navy px-6 font-semibold text-white">
        LiquidPay
      </Link>
    </div>
  );
}
