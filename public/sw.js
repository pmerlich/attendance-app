const RELEASE = new URL(self.location.href).searchParams.get("v") || "development";
const CACHE_NAME = `menahel-avoda-shell-${RELEASE}`;
const APP_SHELL = ["/app-icon.png", "/manifest.webmanifest"];

async function cacheApplicationShell() {
  const cache = await caches.open(CACHE_NAME);
  const shellResponse = await fetch("/");
  if (!shellResponse.ok) throw new Error("Application shell request failed");
  await cache.put("/", shellResponse.clone());
  const html = await shellResponse.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((match) => match[1]);
  await Promise.all([
    ...APP_SHELL.map((url) => cache.add(url)),
    ...[...new Set(assets)].map((url) => cache.add(url)),
  ]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheApplicationShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isRscRequest = url.searchParams.has("_rsc") || (request.headers.get("accept") || "").includes("text/x-component");
  const isFrameworkRequest = url.pathname.startsWith("/_next/") || url.pathname.startsWith("/__debug");
  if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || isRscRequest || isFrameworkRequest) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.mode === "navigate" || APP_SHELL.includes(url.pathname))) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
    return response;
  }).catch(async () => {
    const cached = await caches.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (request.mode === "navigate") return (await caches.match("/")) || Response.error();
    return Response.error();
  }));
});
