/** Frontend push-notification plumbing for a backend that will live on the WP side —
 * this module only handles the *browser* half (registering the service worker,
 * requesting permission, subscribing/unsubscribing the PushManager, and shaping the
 * subscription payload). The WP backend is expected to expose two REST routes once it
 * exists (mirrors a typical `web-push`/wp-webpush plugin setup):
 *   - `GET  /wp-json/funkycommerce/v1/push/vapid-public-key` (or bake the key into
 *     `VITE_VAPID_PUBLIC_KEY` at build time — either works, this file supports both)
 *   - `POST /wp-json/funkycommerce/v1/push/subscribe` with the `PushSubscriptionJSON`
 *   - `POST /wp-json/funkycommerce/v1/push/unsubscribe` with `{ endpoint }`
 * Left unset in this frontend-only mockup, so subscribing resolves locally (mirrors
 * `lib/stripe.ts`'s "no backend yet" fallback) instead of throwing on a missing route. */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
/** When VITE_VAPID_PUBLIC_KEY is not set at build time, push.ts fetches the key
 *  from the WordPress REST endpoint at runtime (configured via WP admin option). */
const VAPID_REST_ENDPOINT = `${import.meta.env.VITE_WP_GRAPHQL_URL?.replace("/graphql", "") ?? ""}/wp-json/funkycommerce/v1/push`;
const PUSH_SUBSCRIBE_ENDPOINT = import.meta.env.VITE_PUSH_SUBSCRIBE_ENDPOINT as string | undefined
  ?? `${VAPID_REST_ENDPOINT}/subscribe`;
const PUSH_UNSUBSCRIBE_ENDPOINT = import.meta.env.VITE_PUSH_UNSUBSCRIBE_ENDPOINT as string | undefined
  ?? `${VAPID_REST_ENDPOINT}/unsubscribe`;

export const isPushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isPushBackendConfigured = Boolean(VAPID_PUBLIC_KEY || VAPID_REST_ENDPOINT);

export type PushPermission = NotificationPermission | "unsupported";

/** Fetches the VAPID public key from env (build-time) or WP REST API (runtime). */
async function resolveVapidPublicKey(): Promise<string | null> {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  try {
    const response = await fetch(`${VAPID_REST_ENDPOINT}/vapid-public-key`);
    if (!response.ok) return null;
    const json = (await response.json()) as { key?: string };
    return typeof json.key === "string" ? json.key : null;
  } catch {
    return null;
  }
}

/** Registers `/sw.js` at the site root (scope `/`, so it can control every route).
 * Safe to call multiple times — the browser no-ops if the same script is already the
 * active registration. Only registers in production builds; in dev the Vite server
 * already handles fast refresh and a stale cached SW would fight it. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported || !import.meta.env.PROD) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export function getCurrentPermission(): PushPermission {
  if (!isPushSupported) return "unsupported";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported) return null;
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Requests notification permission, subscribes the PushManager with the VAPID public
 * key, and (when a subscribe endpoint is configured) hands the subscription to the WP
 * backend so it knows where to deliver future pushes. Returns the subscription so the
 * caller can reflect "subscribed" state in the UI even before a backend exists. */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported) throw new Error("Push notifications aren't supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const vapidKey = await resolveVapidPublicKey();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey ? urlBase64ToUint8Array(vapidKey) : undefined,
    }));

  await sendSubscriptionToBackend(subscription);
  return subscription;
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);

  if (!PUSH_UNSUBSCRIBE_ENDPOINT) return;
  await fetch(PUSH_UNSUBSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}

async function sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  if (!PUSH_SUBSCRIBE_ENDPOINT) return; // No backend yet — subscription still works locally for preview.
  await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  }).catch(() => undefined);
}

/** Standard VAPID key transform — browsers' PushManager API wants the applicationServerKey
 * as a raw `Uint8Array`, but VAPID public keys are normally shared/copy-pasted as a
 * URL-safe base64 string. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
