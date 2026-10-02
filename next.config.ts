import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static build (out/). Same bundle is served by Vercel, cached by the
  // service worker for offline use, and wrapped by Capacitor for the APK.
  output: "export",
  images: { unoptimized: true },
  poweredByHeader: false,
  // Lets a phone on the same Wi-Fi load the dev server.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
};

export default nextConfig;
