export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // avoid SW in dev to prevent stale assets
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

export function useOnlineStatus(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}
