export type RecentOrdersNotifierConfig = {
  enabled: boolean;
  itemCount: number;
  intervalSeconds: number;
  endpoint: string;
};

type RecentOrder = {
  id: string;
  customerFirstName: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number }>;
};

type PersistedRecentOrderState = {
  orderId: string;
  nextAt: number;
};

const STORAGE_KEY = "storefront:recent-orders:v1";
let activeNotifier: { signature: string; stop: () => void } | null = null;

function clampInteger(value: number, min: number, max: number, fallback: number) {
  return Number.isInteger(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function isRecentOrder(value: unknown): value is RecentOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<RecentOrder>;
  return typeof order.id === "string"
    && typeof order.customerFirstName === "string"
    && typeof order.createdAt === "string"
    && !Number.isNaN(Date.parse(order.createdAt))
    && Array.isArray(order.items)
    && order.items.length > 0
    && order.items.every((item) =>
      Boolean(item)
      && typeof item.name === "string"
      && Number.isInteger(item.quantity)
      && item.quantity > 0);
}

function readPersistedState(): PersistedRecentOrderState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<PersistedRecentOrderState> | null;
    return parsed
      && typeof parsed.orderId === "string"
      && Number.isFinite(parsed.nextAt)
      ? { orderId: parsed.orderId, nextAt: Number(parsed.nextAt) }
      : null;
  } catch (error) {
    console.warn("Recent-order notification state could not be restored.", error);
    return null;
  }
}

function writePersistedState(state: PersistedRecentOrderState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Recent-order notification state could not be persisted.", error);
  }
}

function formatOrderItems(order: RecentOrder, language: string) {
  const formatter = new Intl.ListFormat(language, { style: "long", type: "conjunction" });
  return formatter.format(order.items.map(({ name, quantity }) => quantity > 1 ? `${quantity} × ${name}` : name));
}

function formatRelativeTime(createdAt: string, language: string) {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - Date.parse(createdAt)) / 1_000));
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "auto" });
  if (elapsedSeconds < 60) return formatter.format(-elapsedSeconds, "second");
  const minutes = Math.round(elapsedSeconds / 60);
  if (minutes < 60) return formatter.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  const days = Math.round(hours / 24);
  if (days < 30) return formatter.format(-days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return formatter.format(-months, "month");
  return formatter.format(-Math.round(months / 12), "year");
}

function formatOrderMessage(order: RecentOrder) {
  const language = document.documentElement.lang || "en";
  const items = formatOrderItems(order, language);
  const relativeTime = formatRelativeTime(order.createdAt, language);
  if (language.toLowerCase().startsWith("ja")) {
    return `${order.customerFirstName}が${items}を購入しました（${relativeTime}）`;
  }
  const verb = language.toLowerCase().startsWith("pl") ? "kupił(a)" : "bought";
  return `${order.customerFirstName} ${verb} ${items} ${relativeTime}`;
}

function createNotifierElement() {
  document.getElementById("storefront-recent-orders")?.remove();
  const element = document.createElement("aside");
  element.id = "storefront-recent-orders";
  element.className = "storefront-recent-orders";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  element.hidden = true;
  document.body.append(element);
  return element;
}

export async function startRecentOrdersNotifier(input: RecentOrdersNotifierConfig) {
  const config = {
    ...input,
    itemCount: clampInteger(input.itemCount, 1, 10, 5),
    intervalSeconds: clampInteger(input.intervalSeconds, 3, 300, 10),
  };
  const signature = JSON.stringify(config);
  if (activeNotifier?.signature === signature) return activeNotifier.stop;
  activeNotifier?.stop();
  if (!config.enabled) return () => undefined;

  const controller = new AbortController();
  let timer = 0;
  let transitionTimer = 0;
  const element = createNotifierElement();
  const stop = () => {
    controller.abort();
    window.clearTimeout(timer);
    window.clearTimeout(transitionTimer);
    element.remove();
    if (activeNotifier?.stop === stop) activeNotifier = null;
  };
  activeNotifier = { signature, stop };

  let payload: { orders?: unknown[] };
  try {
    const response = await fetch(config.endpoint, {
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Recent-order request failed with ${response.status}.`);
    }
    payload = await response.json() as { orders?: unknown[] };
  } catch (error) {
    stop();
    if (error instanceof DOMException && error.name === "AbortError") return () => undefined;
    throw error;
  }
  const orders = (Array.isArray(payload.orders) ? payload.orders : [])
    .filter(isRecentOrder)
    .slice(0, config.itemCount);
  if (!orders.length) {
    stop();
    return () => undefined;
  }

  const intervalMs = config.intervalSeconds * 1_000;
  const persisted = readPersistedState();
  let index = persisted ? orders.findIndex(({ id }) => id === persisted.orderId) : 0;
  if (index < 0) index = 0;
  let nextAt = persisted && persisted.nextAt > 0 ? persisted.nextAt : Date.now() + intervalMs;
  if (Date.now() >= nextAt) {
    const elapsedIntervals = Math.floor((Date.now() - nextAt) / intervalMs) + 1;
    index = (index + elapsedIntervals) % orders.length;
    nextAt += elapsedIntervals * intervalMs;
  }

  const render = () => {
    const order = orders[index];
    element.textContent = formatOrderMessage(order);
    element.hidden = false;
    element.dataset.visible = "true";
    writePersistedState({ orderId: order.id, nextAt });
    timer = window.setTimeout(() => {
      element.dataset.visible = "false";
      transitionTimer = window.setTimeout(() => {
        if (controller.signal.aborted) return;
        index = (index + 1) % orders.length;
        nextAt = Date.now() + intervalMs;
        render();
      }, 180);
    }, Math.max(0, nextAt - Date.now()));
  };
  render();
  return stop;
}
