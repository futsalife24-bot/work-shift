/* 勤務表ツール Service Worker
   方針: ページ本体はネットワーク優先(更新が自動で届く)、オフライン時はキャッシュで起動 */
const CACHE = "kinmuhyo-v4";
const ASSETS = ["./", "manifest.webmanifest", "icon-192-v2.png", "icon-512-v2.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate" || req.destination === "document") {
    // ネットワーク優先: オンラインなら常に最新版、オフラインならキャッシュ
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./", copy));
        return res;
      }).catch(() => caches.match("./"))
    );
  } else {
    // その他(アイコン等)はキャッシュ優先
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }))
    );
  }
});
