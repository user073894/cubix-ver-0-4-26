export type OfflineState = "unsupported" | "preview" | "installing" | "ready" | "error";

function refused(): boolean {
  const h = location.hostname;
  const inIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  return (
    !import.meta.env.PROD ||
    inIframe ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" ||
    h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" ||
    h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" ||
    h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(location.search).get("sw") === "off"
  );
}

async function unregisterAppSW() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js") || r.installing?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
  );
}

export async function registerOffline(onState: (s: OfflineState) => void) {
  if (!("serviceWorker" in navigator)) return onState("unsupported");
  if (refused()) {
    await unregisterAppSW().catch(() => {});
    return onState("preview");
  }
  try {
    onState("installing");
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((res) => {
        navigator.serviceWorker.addEventListener("controllerchange", () => res(), { once: true });
        setTimeout(res, 4000);
      });
    }
    // Warm the page cache so the app shell opens offline.
    // Warm caches: the page itself plus every same-origin file already loaded
    // before the service worker took control (JS chunks, worker, CSS, fonts, icons).
    const urls = new Set<string>(["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/favicon.png"]);
    for (const e of performance.getEntriesByType("resource")) {
      const u = new URL(e.name);
      if (u.origin === location.origin) urls.add(u.pathname);
    }
    await Promise.all([...urls].map((u) => fetch(u).catch(() => {})));
    onState("ready");
  } catch {
    onState("error");
  }
}
