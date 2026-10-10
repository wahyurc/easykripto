'use strict';

// BEGIN GENERATED PWA RELEASE
const RELEASE = '1ec17190bb63f925';
const SHELL = [
  "admin.css?v=20261010-superadmin",
  "admin.js?v=20261010-superadmin",
  "api-monitor-ui.css?v=20261010-api-monitor",
  "api-monitor-ui.js?v=20261010-api-monitor",
  "api-telemetry.js?v=20261010-api-monitor",
  "app.js?v=20261010-notifications",
  "auth.js?v=20261010-pwa",
  "black-theme.css?v=20261010-provider-logos",
  "dashboard-data.js?v=20261010-notifications",
  "data-client.js?v=20261010-live-dashboard",
  "data-config.js?v=20261010-cloudflare",
  "icons/app-icon.svg",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "live-data.css?v=20261010-token-holders",
  "manifest.webmanifest",
  "market-data.js?v=20261010-api-monitor",
  "market-feed.css?v=20261010-discovery",
  "market-feed.js?v=20261010-discovery",
  "networks.js?v=20261010-token-holders",
  "notifications.css?v=20261010-notifications",
  "notifications.js?v=20261010-notifications",
  "offline.css",
  "offline.html",
  "offline.js",
  "pwa.css?v=20261010-pwa",
  "pwa.js?v=20261010-pwa",
  "search.js?v=20261010-api-monitor",
  "styles.css?v=20261010-superadmin",
  "token-ui.js?v=20261010-token-holders",
  "wallet-data.js?v=20261010-notifications"
];
// END GENERATED PWA RELEASE

const BASE = new URL('./', self.location.href);
const PREFIX = `easykripto-pwa:${BASE.pathname}:`;
const CACHE = PREFIX + RELEASE;
const urls = new Set(SHELL.map(path => new URL(path,BASE).href));
const OFFLINE = new URL('offline.html',BASE).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      // A release is ready only when every public shell asset is present.
      await cache.addAll([...urls].map(url => new Request(url,{cache:'reload'})));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX)&&name!==CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type==='ACTIVATE_UPDATE'&&event.source?.url?.startsWith(BASE.href))event.waitUntil(self.skipWaiting());
});

async function navigate(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),8000);
  try {
    const response = await fetch(request,{signal:controller.signal});
    if(response.ok)return response;
    return await (await caches.open(CACHE)).match(OFFLINE) || response;
  } catch {
    return await (await caches.open(CACHE)).match(OFFLINE) || new Response('Koneksi belum tersedia. Sambungkan internet lalu muat ulang Easykripto.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  } finally {clearTimeout(timeout);}
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method!=='GET'||request.headers.has('Authorization'))return;
  const url = new URL(request.url);
  if(url.origin!==BASE.origin)return;
  if(request.mode==='navigate'&&[BASE.pathname,`${BASE.pathname}index.html`].includes(url.pathname)){
    event.respondWith(navigate(request));return;
  }
  // Exact allowlist: no APIs, Firebase sessions, profile photos, or token data.
  if(!urls.has(url.href))return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(request) || fetch(request);
  })());
});
