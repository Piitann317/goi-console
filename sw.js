"use strict";
/* 語彙コンソール service worker
 * アプリ更新時は CACHE_VERSION を上げること（古いキャッシュは activate で削除される） */
var CACHE_VERSION = "vocab-console-v5";
var APP_SHELL = [
  "./",
  "index.html",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return; // API呼び出し(POST)はネットワーク直行
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外部オリジンは触らない

  if (req.mode === "navigate") {
    // ページ本体: ネットワーク優先（オンライン時は常に最新）、オフライン時はキャッシュ
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put("index.html", copy); });
        return res;
      }).catch(function () {
        return caches.match("index.html").then(function (hit) {
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  // その他の同一オリジン資産: キャッシュ優先＋裏で更新
  event.respondWith(
    caches.match(req).then(function (hit) {
      var refresh = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || refresh;
    })
  );
});
