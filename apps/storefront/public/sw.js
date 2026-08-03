// FunkyCommerce service worker — prepares the storefront for installable/offline PWA
// behavior and for push notifications that will be *sent* by the WordPress backend
// (this file only handles receiving/displaying them; subscribing is driven from
// `src/lib/push.ts`). Kept dependency-free (no Workbox) since this is still a
// frontend-only mockup — swap in a build-time precache manifest once the app is wired
// to a real backend and asset hashes are meaningful to precache deterministically.

const VERSION = "v1";
const APP_SHELL_CACHE = `funkycommerce-shell-${VERSION}`;
const RUNTIME_CACHE = `funkycommerce-runtime-${VERSION}`;

// Small, hand-picked shell so the app can still boot to *something* offline. Hashed
// build assets (JS/CSS in dist/assets) aren't listed here since their filenames change
// per build — those get opportunistically cached by the runtime "stale-while-
// revalidate" handler below the first time they're fetched instead.
const APP_SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/app/icon.svg", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Lets the page force an already-waiting worker to activate immediately (used by the
// "Update available" prompt a future version of the update-toast UI can send).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// Network-first for navigations (so users get fresh HTML whenever online), falling
// back to the cached shell when offline. Stale-while-revalidate for same-origin GET
// assets otherwise, so repeat visits are fast and the app keeps working offline once
// warmed up.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request).then((cached) => cached ?? caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(() => cached);
      return cached ?? network;
    })
  );
});

// --- Push notifications -----------------------------------------------------------
// The WP backend (e.g. via a Web Push library alongside its VAPID keypair) sends the
// actual push payload; this handler only renders it. Payload shape is up to the
// backend integration — this defensively falls back to generic copy if fields are
// missing so a minimal/legacy payload still shows *something* readable.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : undefined };
  }

  const title = payload.title ?? "FunkyCommerce";
  const options = {
    body: payload.body ?? "You have a new notification.",
    icon: payload.icon ?? "/icons/app/icon-192.png",
    badge: payload.badge ?? "/icons/app/badge-96.png",
    image: payload.image,
    tag: payload.tag ?? "funkycommerce-notification",
    data: { url: payload.url ?? "/", ...payload.data },
    actions: Array.isArray(payload.actions) ? payload.actions : undefined,
    vibrate: payload.silent ? undefined : [100, 50, 100],
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focuses an already-open tab on the target URL if one exists, otherwise opens a new
// one — standard "deep link back into the SPA" pattern for notification taps.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.postMessage({ type: "NOTIFICATION_NAVIGATE", url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // The browser rotated the push subscription (expired keys, etc). Re-subscribe with
  // the same application server key and hand the fresh subscription back to the page
  // (or, once a backend exists, POST it directly from here) so the WP backend's stored
  // subscription doesn't silently go stale.
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription ? { applicationServerKey: event.oldSubscription.options.applicationServerKey, userVisibleOnly: true } : undefined)
      .then((subscription) =>
        self.clients.matchAll().then((clientList) => {
          clientList.forEach((client) => client.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: subscription.toJSON() }));
        })
      )
      .catch(() => undefined)
  );
});
