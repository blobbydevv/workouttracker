// Offline shell. Navigations: network first, falling back to the cached app shell.
// Assets: cache first. Only successful responses are cached, so a host error page
// can never replace the app. Data lives in IndexedDB, so logging works offline.
const CACHE = "shell-v3";
// Paths are relative to the worker scope so the app works in a subfolder (GitHub Pages).
const BASE = new URL("./", self.location).pathname;
const SHELL = BASE + "index.html";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SHELL, BASE + "manifest.webmanifest"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith(BASE + "api/")) return;
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
            return r;
          }
          // Host has no route for this app path: serve the app shell instead of its error page.
          return caches.match(SHELL).then((hit) => hit || r);
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        }),
    ),
  );
});
