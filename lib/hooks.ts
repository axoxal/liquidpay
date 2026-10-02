"use client";

import { useSyncExternalStore } from "react";
import { useApp } from "./store";

/** True once zustand has rehydrated from localStorage (avoids SSR mismatch). */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useApp.persist.onFinishHydration(cb),
    () => useApp.persist.hasHydrated(),
    () => false,
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Real connectivity, overridable by the demo "pretend offline" switch. */
export function useOnline() {
  const real = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const demoOffline = useApp((s) => s.settings.demoOffline);
  return real && !demoOffline;
}
