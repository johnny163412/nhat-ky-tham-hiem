// Network first, cache as fallback: new content shows at once online, the last copy works offline.
const CACHE = "nhatky-v3";
const SHELL = ["./", "index.html", "style.css", "app.js", "cards.json", "glossary.json", "icon.svg", "manifest.webmanifest"];

self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
));
self.addEventListener("fetch", e => {
  // only our own files: map tiles and Wikipedia would grow the cache without limit
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request)
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request)));
});
