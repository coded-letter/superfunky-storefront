// FunkyCommerce service worker for installable/offline behavior and notifications sent
// by the protected WordPress backend. Registration and push synchronization live in
// `src/lib/push.ts` and start only after the React application activates.

const VERSION = "__FUNKYCOMMERCE_BUILD_VERSION__";
const APP_SHELL_CACHE = `funkycommerce-shell-${VERSION}`;
const RUNTIME_CACHE = `funkycommerce-runtime-${VERSION}`;

// Small, hand-picked shell so the app can still boot to *something* offline. Hashed
// build assets (JS/CSS in dist/assets) aren't listed here since their filenames change
// per build — those get opportunistically cached by the runtime "stale-while-
// revalidate" handler below the first time they're fetched instead.
// Do not precache a document here. During a deploy, the newly stamped worker can
// become visible before every CDN edge has the matching HTML; caching "/" during
// install would then pin an old style/font contract in the new deployment cache.
const APP_SHELL_URLS = ["/manifest.webmanifest", "/icons/app/icon.svg", "/favicon.ico"];

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
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
              .map((key) => caches.delete(key))
          )
        ),
      self.registration.navigationPreload?.enable(),
    ])
      .then(() => self.clients.claim())
  );
});

// Lets the page force an already-waiting worker to activate immediately (used by the
// "Update available" prompt a future version of the update-toast UI can send).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheSuccessfulResponse(request, response) {
  if (!response.ok) return response;
  const cache = await caches.open(RUNTIME_CACHE);
  await cache.put(request, response.clone());
  return response;
}

// Navigations prefer the CDN response so a newly deployed hydration policy cannot be
// hidden by an older cached document. Navigation preload starts that request while the
// worker wakes; the last complete SSG document remains an offline fallback. Hashed assets
// below stay cache-first, keeping repeat-visit application startup effectively immediate.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === "navigate") {
    const network = Promise.resolve(event.preloadResponse)
      .then((preloaded) => preloaded || fetch(request))
      .then((response) => cacheSuccessfulResponse(request, response));
    event.respondWith(
      network.catch(async () =>
        (await caches.match(request, { ignoreVary: true })) ?? Response.error()
      )
    );
    return;
  }

  const network = fetch(request).then((response) => cacheSuccessfulResponse(request, response));
  const safeNetwork = network.catch(() => null);
  event.waitUntil(safeNetwork.then(() => undefined));
  event.respondWith(
    caches.match(request).then(async (cached) => cached ?? await safeNetwork ?? Response.error())
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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) payload = {};
  const title = typeof payload.title === "string" ? payload.title.slice(0, 120) : "Superfunky";
  const requestedUrl = typeof payload.url === "string" ? payload.url : "/";
  let safeUrl = "/";
  try {
    const parsedUrl = new URL(requestedUrl, self.location.origin);
    if (parsedUrl.origin === self.location.origin) safeUrl = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    safeUrl = "/";
  }
  const options = {
    body: typeof payload.body === "string" ? payload.body.slice(0, 240) : "You have a new notification.",
    icon: typeof payload.icon === "string" ? payload.icon : "/icons/app/icon-192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icons/app/icon-192.png",
    image: typeof payload.image === "string" ? payload.image : undefined,
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 64) : "funkycommerce-notification",
    data: { ...(payload.data && typeof payload.data === "object" ? payload.data : {}), url: safeUrl },
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
  let targetUrl = new URL("/", self.location.origin).href;
  try {
    const requestedUrl = new URL(event.notification.data?.url ?? "/", self.location.origin);
    if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl.href;
  } catch {
    targetUrl = new URL("/", self.location.origin).href;
  }

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
  // The browser rotated the subscription. Re-subscribe with the existing application
  // server key and hand the fresh record to a page for backend synchronization.
  const applicationServerKey = event.oldSubscription?.options?.applicationServerKey;
  const notifyClients = (message) =>
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      clientList.forEach((client) => client.postMessage(message));
    });
  event.waitUntil(
    (applicationServerKey
      ? self.registration.pushManager
          .subscribe({ applicationServerKey, userVisibleOnly: true })
          .then((subscription) =>
            notifyClients({ type: "PUSH_SUBSCRIPTION_CHANGED", subscription: subscription.toJSON() })
          )
      : notifyClients({ type: "PUSH_SUBSCRIPTION_SYNC_REQUIRED" })
    ).catch(() => notifyClients({ type: "PUSH_SUBSCRIPTION_SYNC_REQUIRED" }))
  );
});
