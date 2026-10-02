"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

/** Registers the offline service worker in production builds only. */
export function ServiceWorker() {
  useEffect(() => {
    // The Android app already bundles every file, so no service worker there.
    if (process.env.NODE_ENV !== "production" || isNativeApp() || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* offline caching is best-effort */
    });
  }, []);
  return null;
}
