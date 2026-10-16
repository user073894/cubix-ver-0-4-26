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
    // Warm the page cache so the app shell opens offline.
    await fetch("/", { cache: "no-store" }).catch(() => {});
    onState("ready");
  } catch {
    onState("error");
  }
}
