// Tiny Typer service worker.
// App files: network first, so a new deploy shows up straight away,
// with the cached copy used when offline.
// Google Fonts: cache first, since those URLs never change.

const CACHE = "tinytyper-v2";
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Bubblegum+Sans&family=Fredoka:wght@400;600;700&family=Gaegu:wght@400;700&family=Patrick+Hand&display=swap";

const APP_FILES = [
  "./",
  "index.html",
  "style.css",
  "main.js",
  "editor.js",
  "vendor/gsap.min.js",
  "manifest.webmanifest",
  "favicon.svg",
  "favicon-32.png",
  "favicon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(APP_FILES);
      // Fonts are a nice-to-have offline; never fail the install over them.
      try {
        const res = await fetch(FONT_CSS);
        const css = await res.clone().text();
        await cache.put(FONT_CSS, res);
        // Only the Latin subsets: the full set is ~190 files (Gaegu ships Korean).
        const fontUrls = [...css.matchAll(/\/\* (latin|latin-ext) \*\/[^}]*?url\((https:[^)]+)\)/g)].map((m) => m[2]);
        await Promise.all(
          fontUrls.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok && cache.put(u, r)).catch(() => {}))
        );
      } catch (_) {}
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          // no-cache: revalidate with the server so a new deploy is never masked
          const res = await fetch(request, { cache: "no-cache" });
          if (res.ok) cache.put(request, res.clone());
          return res;
        } catch (_) {
          const hit = await cache.match(request, { ignoreSearch: true });
          return hit || (request.mode === "navigate" ? cache.match("index.html") : Response.error());
        }
      })()
    );
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      })()
    );
  }
});
