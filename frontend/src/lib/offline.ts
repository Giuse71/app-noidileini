import { useEffect, useSyncExternalStore } from "react";

export const LAST_SYNC_KEY = "lv-card-updated";

// navigator.onLine misses "bars but no data"; the service worker also reports
// whether the last API answer came from the network or from its saved copy.
let swOnline = true;
const listeners = new Set<() => void>();
if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (e: MessageEvent<{ type?: string; online?: boolean }>) => {
    if (e.data?.type === "lv-net" && e.data.online !== swOnline) {
      swOnline = Boolean(e.data.online);
      listeners.forEach((l) => l());
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, () => navigator.onLine && swOnline, () => true);
}

/** Remembers when the card data last came from the network; returns that timestamp (ms). */
export function useLastSync(dataUpdatedAt: number, online: boolean): number {
  useEffect(() => {
    if (online && dataUpdatedAt) localStorage.setItem(LAST_SYNC_KEY, String(dataUpdatedAt));
  }, [online, dataUpdatedAt]);
  return (online ? dataUpdatedAt : Number(localStorage.getItem(LAST_SYNC_KEY))) || dataUpdatedAt || 0;
}

export function syncLabel(ts: number): string {
  if (!ts) return "mai";
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(ts);
}
