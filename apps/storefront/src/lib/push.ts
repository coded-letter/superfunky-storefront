import { restUrl } from "@funky/sdk";
import { getAuthTokenForRequest } from "./auth";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim();
const PUSH_BASE_ENDPOINT = restUrl("funkycommerce/v1/push");
const PUSH_SUBSCRIBE_ENDPOINT = PUSH_BASE_ENDPOINT ? `${PUSH_BASE_ENDPOINT}/subscribe` : undefined;
const PUSH_UNSUBSCRIBE_ENDPOINT = PUSH_BASE_ENDPOINT ? `${PUSH_BASE_ENDPOINT}/unsubscribe` : undefined;
const PUSH_PREFERENCES_ENDPOINT = PUSH_BASE_ENDPOINT ? `${PUSH_BASE_ENDPOINT}/preferences` : undefined;
const VAPID_ENDPOINT = PUSH_BASE_ENDPOINT ? `${PUSH_BASE_ENDPOINT}/vapid-public-key` : undefined;

export const isPushSupported =
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const isPushBackendConfigured = Boolean(PUSH_SUBSCRIBE_ENDPOINT && (VAPID_PUBLIC_KEY || VAPID_ENDPOINT));

export type PushPermission = NotificationPermission | "unsupported";

export class PushBackendError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "PushBackendError";
    this.status = status;
    this.code = code;
  }
}

type WordPressError = { code?: unknown; message?: unknown };

async function requireSuccessfulResponse(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  let error: WordPressError = {};
  try {
    error = (await response.json()) as WordPressError;
  } catch {
    // Non-JSON proxy and gateway failures use the status fallback below.
  }
  const message = typeof error.message === "string" && error.message.trim()
    ? error.message
    : `${fallback} (HTTP ${response.status}).`;
  throw new PushBackendError(message, response.status, typeof error.code === "string" ? error.code : undefined);
}

async function resolveVapidPublicKey(): Promise<string> {
  if (VAPID_PUBLIC_KEY) return VAPID_PUBLIC_KEY;
  if (!VAPID_ENDPOINT) throw new PushBackendError("The push backend is not configured.");

  let response: Response;
  try {
    response = await fetch(VAPID_ENDPOINT, { headers: { Accept: "application/json" } });
  } catch {
    throw new PushBackendError("The push backend could not be reached.");
  }
  await requireSuccessfulResponse(response, "The VAPID public key could not be loaded");
  const json = (await response.json()) as { key?: unknown };
  if (typeof json.key !== "string" || !json.key.trim()) {
    throw new PushBackendError("The push backend returned an invalid public key.", response.status);
  }
  return json.key;
}

/** Registers the root service worker in production and installs its page bridge. */
export async function registerServiceWorker(refreshExisting = true): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported || !import.meta.env.PROD) return null;
  installPushServiceWorkerBridge();
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    if (refreshExisting && Notification.permission === "granted" && PUSH_SUBSCRIBE_ENDPOINT) {
      void registration.pushManager
        .getSubscription()
        .then((subscription) => subscription ? sendSubscriptionToBackend(subscription) : undefined)
        .catch((error) => console.warn("Could not refresh the push subscription.", error));
    }
    return registration;
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
  const registration = await navigator.serviceWorker.getRegistration("/").catch(() => undefined);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/** Subscribe locally and require successful backend synchronization. */
export async function subscribeToPush(): Promise<PushSubscription> {
  if (!isPushSupported) throw new Error(getPushEnablementGuidance());
  if (isIosBrowser() && !isStandaloneDisplay()) throw new Error(getPushEnablementGuidance());
  if (!import.meta.env.PROD) throw new Error("Push notifications require a production HTTPS deployment.");
  if (!isPushBackendConfigured) throw new PushBackendError("The push backend is not configured.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await registerServiceWorker(false);
  if (!registration) throw new Error("Push notifications require a production HTTPS deployment.");
  const existing = await registration.pushManager.getSubscription();
  const vapidKey = await resolveVapidPublicKey();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    }));

  try {
    await sendSubscriptionToBackend(subscription);
  } catch (error) {
    if (!existing) await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
  return subscription;
}

/** Remove the server record before deleting the only local copy of its endpoint. */
export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  if (!PUSH_UNSUBSCRIBE_ENDPOINT) throw new PushBackendError("The push backend is not configured.");

  let response: Response;
  try {
    response = await fetch(PUSH_UNSUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    });
  } catch {
    throw new PushBackendError("The push backend could not be reached.");
  }
  await requireSuccessfulResponse(response, "The subscription could not be removed");
  const removed = await subscription.unsubscribe();
  if (!removed) throw new Error("The browser could not remove the local push subscription.");
}

/** Reconcile a browser-rotated subscription with WordPress. */
export async function syncPushSubscription(allowCreate = false): Promise<PushSubscription | null> {
  if (!isPushSupported || Notification.permission !== "granted") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return null;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription && allowCreate) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(await resolveVapidPublicKey()),
    });
  }
  if (subscription) await sendSubscriptionToBackend(subscription);
  return subscription;
}

/** Authenticated request headers so category preferences can be associated with a logged-in user. */
async function pushHeaders(): Promise<Record<string, string>> {
  const token = await getAuthTokenForRequest();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Save which activity categories (orders, community, marketing) this subscription should receive. */
export async function updatePushPreferences(categories: string[]): Promise<void> {
  const subscription = await getExistingSubscription();
  if (!subscription) throw new PushBackendError("Subscribe to push notifications before choosing categories.");
  if (!PUSH_PREFERENCES_ENDPOINT) throw new PushBackendError("The push backend is not configured.");

  let response: Response;
  try {
    response = await fetch(PUSH_PREFERENCES_ENDPOINT, {
      method: "POST",
      headers: await pushHeaders(),
      body: JSON.stringify({ endpoint: subscription.endpoint, categories }),
    });
  } catch {
    throw new PushBackendError("The push backend could not be reached.");
  }
  await requireSuccessfulResponse(response, "The notification preferences could not be saved");
}

/** Load which activity categories this subscription currently receives. */
export async function getPushPreferences(): Promise<string[]> {
  const subscription = await getExistingSubscription();
  if (!subscription || !PUSH_PREFERENCES_ENDPOINT) return [];

  let response: Response;
  try {
    response = await fetch(`${PUSH_PREFERENCES_ENDPOINT}?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
      headers: await pushHeaders(),
    });
  } catch {
    throw new PushBackendError("The push backend could not be reached.");
  }
  await requireSuccessfulResponse(response, "The notification preferences could not be loaded");
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? payload.filter((item): item is string => typeof item === "string") : [];
}

async function sendSubscriptionToBackend(subscription: PushSubscription | PushSubscriptionJSON): Promise<void> {
  if (!PUSH_SUBSCRIBE_ENDPOINT) throw new PushBackendError("The push backend is not configured.");
  const payload = "toJSON" in subscription ? subscription.toJSON() : subscription;
  let response: Response;
  try {
    response = await fetch(PUSH_SUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new PushBackendError("The push backend could not be reached.");
  }
  await requireSuccessfulResponse(response, "The subscription could not be synchronized");
}

let bridgeInstalled = false;

/** Handle subscription rotation and safe notification navigation from the worker. */
export function installPushServiceWorkerBridge(): void {
  if (!isPushSupported || bridgeInstalled) return;
  bridgeInstalled = true;
  navigator.serviceWorker.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source && navigator.serviceWorker.controller && event.source !== navigator.serviceWorker.controller) return;
    const message = event.data as { type?: unknown; url?: unknown; subscription?: unknown } | null;
    if (!message || typeof message.type !== "string") return;

    if (message.type === "NOTIFICATION_NAVIGATE") {
      const destination = resolvePushNavigationUrl(message.url);
      if (destination) window.location.assign(destination);
      return;
    }
    if (message.type === "PUSH_SUBSCRIPTION_CHANGED" && message.subscription && typeof message.subscription === "object") {
      void sendSubscriptionToBackend(message.subscription as PushSubscriptionJSON).catch((error) => {
        console.warn("Could not synchronize the rotated push subscription.", error);
      });
      return;
    }
    if (message.type === "PUSH_SUBSCRIPTION_SYNC_REQUIRED") {
      void syncPushSubscription(true).catch((error) => {
        console.warn("Could not restore the push subscription.", error);
      });
    }
  });
}

export function resolvePushNavigationUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/** Browser-specific help for unsupported mobile enablement flows. */
export function getPushEnablementGuidance(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): string {
  const ios = isIosBrowser(userAgent);
  if (ios) {
    return isStandaloneDisplay()
      ? "Allow notifications in iOS Settings for this Home Screen app."
      : "On iPhone or iPad, open this site in Safari, choose Share > Add to Home Screen, then enable notifications from the installed app.";
  }
  if (/Android/i.test(userAgent)) {
    return "Use a current Chrome, Edge, Firefox, or Samsung Internet browser and allow notifications in the browser's site settings.";
  }
  return "Push notifications aren't supported in this browser. Try a current Chrome, Edge, Firefox, or Safari release.";
}

function isIosBrowser(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent));
}

function isStandaloneDisplay(): boolean {
  return typeof window !== "undefined"
    && (window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  if (!/^[A-Za-z0-9_-]+$/.test(base64String)) throw new PushBackendError("The VAPID public key is invalid.");
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  if (rawData.length !== 65 || rawData.charCodeAt(0) !== 4) throw new PushBackendError("The VAPID public key is invalid.");
  const bytes = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let index = 0; index < rawData.length; index += 1) bytes[index] = rawData.charCodeAt(index);
  return bytes.buffer;
}
