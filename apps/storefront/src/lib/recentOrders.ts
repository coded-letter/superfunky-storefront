export type RecentOrdersNotifierConfig = {
  enabled: boolean;
  itemCount: number;
  intervalSeconds: number;
  quietSeconds: number;
  openLinksInNewTab?: boolean;
  endpoint: string;
};

type RecentOrder = {
  id: string;
  customerFirstName: string;
  createdAt: string;
  items: Array<{ name: string; quantity: number; url?: string }>;
};

type PersistedRecentOrderState = {
  orderId: string;
  nextAt: number;
  cycleMs: number;
};

const STORAGE_KEY = "storefront:recent-orders:v2";
const DISMISSAL_KEY = "storefront:recent-orders:dismissed:v1";
let activeNotifier: { signature: string; stop: () => void } | null = null;

type ListFormatPart = { type: "element" | "literal"; value: string };
type ListFormatter = {
  format: (values: string[]) => string;
  formatToParts: (values: string[]) => ListFormatPart[];
};

function createListFormatter(language: string): ListFormatter {
  const Constructor = (Intl as typeof Intl & {
    ListFormat: new (locales: string, options: { style: "long"; type: "conjunction" }) => ListFormatter;
  }).ListFormat;
  return new Constructor(language, { style: "long", type: "conjunction" });
}

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
      && item.quantity > 0
      && (item.url === undefined || typeof item.url === "string"));
}

function readPersistedState(cycleMs: number): PersistedRecentOrderState | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as Partial<PersistedRecentOrderState> | null;
    return parsed
      && typeof parsed.orderId === "string"
      && Number.isFinite(parsed.nextAt)
      && parsed.cycleMs === cycleMs
      ? { orderId: parsed.orderId, nextAt: Number(parsed.nextAt), cycleMs }
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
  const formatter = createListFormatter(language);
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

function storefrontProductHref(url: string | undefined) {
  if (!url?.trim()) return null;
  const parsed = new URL(url, window.location.origin);
  if (!["http:", "https:"].includes(parsed.protocol)) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function renderOrderItems(
  container: HTMLElement,
  order: RecentOrder,
  language: string,
  openLinksInNewTab: boolean,
) {
  const labels = order.items.map(({ name, quantity }) => quantity > 1 ? `${quantity} × ${name}` : name);
  const parts = createListFormatter(language).formatToParts(labels);
  let itemIndex = 0;
  for (const part of parts) {
    if (part.type !== "element") {
      container.append(document.createTextNode(part.value));
      continue;
    }
    const item = order.items[itemIndex++];
    const href = storefrontProductHref(item.url);
    if (!href) {
      container.append(document.createTextNode(part.value));
      continue;
    }
    const link = document.createElement("a");
    link.className = "storefront-recent-orders__product";
    link.href = href;
    link.textContent = part.value;
    if (openLinksInNewTab) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    container.append(link);
  }
}

function renderOrder(
  element: HTMLElement,
  order: RecentOrder,
  openLinksInNewTab: boolean,
  onDismiss: () => void,
) {
  const language = document.documentElement.lang || "en";
  const isJapanese = language.toLowerCase().startsWith("ja");
  const lead = isJapanese
    ? `${order.customerFirstName}が`
    : `${order.customerFirstName} ${language.toLowerCase().startsWith("pl") ? "kupił(a)" : "bought"} `;
  const message = document.createElement("p");
  message.className = "storefront-recent-orders__message";
  message.append(document.createTextNode(lead));

  const itemList = document.createElement("span");
  itemList.className = "storefront-recent-orders__items";
  renderOrderItems(itemList, order, language, openLinksInNewTab);
  message.append(itemList);
  if (isJapanese) message.append(document.createTextNode("を購入しました"));

  const time = document.createElement("time");
  time.className = "storefront-recent-orders__time";
  time.dateTime = order.createdAt;
  time.textContent = formatRelativeTime(order.createdAt, language);

  const content = document.createElement("div");
  content.className = "storefront-recent-orders__content";
  content.append(message, time);
  const dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "storefront-recent-orders__dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss recent order notifications");
  dismissButton.textContent = "×";
  dismissButton.addEventListener("click", onDismiss);
  element.replaceChildren(content, dismissButton);
  element.setAttribute("aria-label", formatOrderMessage(order));
}

function syncChatbotOffset(element: HTMLElement) {
  element.dataset.chatbotOffset = String(Boolean(document.getElementById("funkycommerce-ai-assistant-root")));
}

function createNotifierElement() {
  document.getElementById("storefront-recent-orders")?.remove();
  const element = document.createElement("div");
  element.id = "storefront-recent-orders";
  element.className = "storefront-recent-orders";
  element.setAttribute("role", "status");
  element.setAttribute("aria-live", "polite");
  element.setAttribute("aria-atomic", "true");
  element.hidden = true;
  document.body.append(element);
  syncChatbotOffset(element);
  return element;
}

export async function startRecentOrdersNotifier(input: RecentOrdersNotifierConfig) {
  const config = {
    ...input,
    itemCount: clampInteger(input.itemCount, 1, 10, 5),
    intervalSeconds: clampInteger(input.intervalSeconds, 3, 300, 10),
    quietSeconds: clampInteger(input.quietSeconds, 2, 300, 8),
  };
  const signature = JSON.stringify(config);
  if (activeNotifier?.signature === signature) return activeNotifier.stop;
  activeNotifier?.stop();
  if (!config.enabled) return () => undefined;
  try {
    if (window.sessionStorage.getItem(DISMISSAL_KEY) === "true") return () => undefined;
  } catch (error) {
    console.warn("Recent-order dismissal preference is unavailable.", error);
  }

  const controller = new AbortController();
  let hideTimer = 0;
  let hideTransitionTimer = 0;
  let cycleTimer = 0;
  const element = createNotifierElement();
  const chatbotObserver = new window.MutationObserver(() => {
    syncChatbotOffset(element);
    if (document.documentElement.dataset.storefrontCheckout === "true") {
      element.dataset.visible = "false";
      element.hidden = true;
    }
  });
  chatbotObserver.observe(document.body, { childList: true, subtree: true });
  chatbotObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-storefront-checkout"],
  });
  const stop = () => {
    controller.abort();
    chatbotObserver.disconnect();
    window.clearTimeout(hideTimer);
    window.clearTimeout(hideTransitionTimer);
    window.clearTimeout(cycleTimer);
    element.remove();
    if (activeNotifier?.stop === stop) activeNotifier = null;
  };
  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISSAL_KEY, "true");
    } catch (error) {
      console.warn("Recent-order dismissal preference could not be saved.", error);
    }
    stop();
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

  const displayMs = config.intervalSeconds * 1_000;
  const quietMs = config.quietSeconds * 1_000;
  const cycleMs = displayMs + quietMs;
  const persisted = readPersistedState(cycleMs);
  let index = persisted ? orders.findIndex(({ id }) => id === persisted.orderId) : 0;
  if (index < 0) index = 0;
  let nextAt = persisted && persisted.nextAt > 0 ? persisted.nextAt : Date.now() + cycleMs;
  if (Date.now() >= nextAt) {
    const elapsedCycles = Math.floor((Date.now() - nextAt) / cycleMs) + 1;
    index = (index + elapsedCycles) % orders.length;
    nextAt += elapsedCycles * cycleMs;
  }

  const scheduleCycle = () => {
    window.clearTimeout(hideTimer);
    window.clearTimeout(hideTransitionTimer);
    const order = orders[index];
    const now = Date.now();
    const displayEndsAt = nextAt - quietMs;
    writePersistedState({ orderId: order.id, nextAt, cycleMs });
    if (now < displayEndsAt && document.documentElement.dataset.storefrontCheckout !== "true") {
      renderOrder(element, order, config.openLinksInNewTab !== false, dismiss);
      element.hidden = false;
      element.dataset.visible = "true";
      hideTimer = window.setTimeout(() => {
        element.dataset.visible = "false";
        hideTransitionTimer = window.setTimeout(() => {
          if (!controller.signal.aborted) element.hidden = true;
        }, 180);
      }, displayEndsAt - now);
    } else {
      element.dataset.visible = "false";
      element.hidden = true;
    }
    cycleTimer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      const elapsedCycles = Math.floor((Date.now() - nextAt) / cycleMs) + 1;
      index = (index + Math.max(1, elapsedCycles)) % orders.length;
      nextAt += Math.max(1, elapsedCycles) * cycleMs;
      scheduleCycle();
    }, Math.max(0, nextAt - now));
  };
  scheduleCycle();
  return stop;
}
