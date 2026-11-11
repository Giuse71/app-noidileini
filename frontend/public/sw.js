// Network-first service worker: always fresh online, last good copy offline
// (so the athlete's card + QR still opens at the counter with poor signal).
const CACHE = "lv-cache";
const API_ALLOW = [
  "/api/auth/me", "/api/association", "/api/athletes/me/family", "/api/merchants", "/api/transactions/mine",
  "/api/categories", "/api/manifest.webmanifest",
];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") && !API_ALLOW.includes(url.pathname) && !url.pathname.startsWith("/api/files/") && !url.pathname.startsWith("/api/icons/")) return;
  if (url.pathname.startsWith("/@") || url.pathname.includes("__emergent")) return;

  const isApi = url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/files/") && !url.pathname.startsWith("/api/icons/");
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (isApi) notify(true);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        if (isApi) notify(false);
        const hit = await caches.match(req);
        if (hit) return hit;
        if (req.mode === "navigate") {
          const shell = (await caches.match("/atleta")) || (await caches.match("/"));
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});

// Tells open pages whether API data came from the network (true) or from the saved copy (false).
function notify(online) {
  self.clients.matchAll({ type: "window" }).then((cs) => cs.forEach((c) => c.postMessage({ type: "lv-net", online })));
}
