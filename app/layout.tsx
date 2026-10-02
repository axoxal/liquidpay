import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Noto_Sans_Devanagari, Noto_Sans_Malayalam } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"] });
const mlym = Noto_Sans_Malayalam({ variable: "--font-mlym", subsets: ["malayalam"] });

export const metadata: Metadata = {
  title: "LiquidPay — UPI without internet",
  description: "Offline UPI payments over 123Pay and *99#. Open source.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "LiquidPay", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#93a6a7",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="day" className={`${display.variable} ${deva.variable} ${mlym.variable} antialiased`}>
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
