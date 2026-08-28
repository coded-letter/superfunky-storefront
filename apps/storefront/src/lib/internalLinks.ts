export const NATIVE_LINK_ATTRIBUTE = "data-funky-native-link";

export type InternalLink = {
  kind: "internal";
  url: URL;
  to: string;
  mappedFromBackend: boolean;
};

export type LinkClassification =
  | InternalLink
  | { kind: "native"; reason: string };

export type LinkEnvironment = {
  currentUrl: string;
  storefrontOrigin: string;
  backendOrigin?: string;
};

const NATIVE_PROTOCOLS = new Set(["mailto:", "tel:", "javascript:", "data:", "blob:"]);
const NON_CONTENT_BACKEND_PATHS = [
  /^\/wp-admin(?:\/|$)/i,
  /^\/wp-login\.php$/i,
  /^\/wp-json(?:\/|$)/i,
  /^\/graphql(?:\/|$)/i,
  /^\/xmlrpc\.php$/i,
];

export function normalizeContentHref(
  href: string,
  environment: Pick<LinkEnvironment, "storefrontOrigin" | "backendOrigin"> & { baseUrl?: string },
): string {
  const value = href.trim();
  if (!value) return value;

  try {
    const url = new URL(value, environment.baseUrl || environment.storefrontOrigin);
    if (!["http:", "https:"].includes(url.protocol)) return value;
    if (
      url.origin === environment.storefrontOrigin
      || (url.origin === environment.backendOrigin && isBackendContentUrl(url))
    ) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.href;
  } catch {
    return value;
  }
}

export function classifyAnchor(
  anchor: HTMLAnchorElement,
  environment: LinkEnvironment,
  options: { allowNewContext?: boolean } = {},
): LinkClassification {
  if (anchor.hasAttribute(NATIVE_LINK_ATTRIBUTE)) return { kind: "native", reason: "opt-out" };
  if (anchor.hasAttribute("download")) return { kind: "native", reason: "download" };

  const target = anchor.getAttribute("target")?.trim().toLowerCase();
  if (target && target !== "_self" && !options.allowNewContext) {
    return { kind: "native", reason: "target" };
  }
  if (anchor.rel.split(/\s+/).some((token) => token.toLowerCase() === "external")) {
    return { kind: "native", reason: "external-rel" };
  }

  const rawHref = anchor.getAttribute("href")?.trim();
  if (!rawHref) return { kind: "native", reason: "missing-href" };
  if (rawHref.startsWith("#")) return { kind: "native", reason: "hash-only" };

  let url: URL;
  try {
    url = new URL(rawHref, environment.currentUrl);
  } catch {
    return { kind: "native", reason: "invalid-url" };
  }

  if (NATIVE_PROTOCOLS.has(url.protocol) || !["http:", "https:"].includes(url.protocol)) {
    return { kind: "native", reason: "protocol" };
  }

  const mappedFromBackend = Boolean(
    environment.backendOrigin
    && url.origin === environment.backendOrigin
    && isBackendContentUrl(url),
  );
  if (url.origin !== environment.storefrontOrigin && !mappedFromBackend) {
    return { kind: "native", reason: "external-origin" };
  }

  if (mappedFromBackend) {
    url = new URL(`${url.pathname}${url.search}${url.hash}`, environment.storefrontOrigin);
  }

  const current = new URL(environment.currentUrl);
  if (url.pathname === current.pathname && url.search === current.search) {
    return { kind: "native", reason: url.hash ? "same-page-anchor" : "current-url" };
  }

  return {
    kind: "internal",
    url,
    to: `${url.pathname}${url.search}${url.hash}`,
    mappedFromBackend,
  };
}

export function isUnmodifiedPrimaryClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented
    && event.button === 0
    && !event.metaKey
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
  );
}

export function shouldAvoidPrefetch(navigatorLike: Navigator): boolean {
  const connection = (navigatorLike as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  return Boolean(
    connection?.saveData
    || connection?.effectiveType === "2g"
    || connection?.effectiveType === "slow-2g",
  );
}

export function mountHashAnchorScroll({
  document,
  window,
  hash,
  timeoutMs = 2_000,
}: {
  document: Document;
  window: Window;
  hash: string;
  timeoutMs?: number;
}): () => void {
  const rawId = hash.replace(/^#/, "");
  let id = rawId;
  try {
    id = decodeURIComponent(rawId);
  } catch {
    // Browsers leave malformed percent-escapes untouched in fragment identifiers.
  }

  let currentTarget: HTMLElement | null = null;
  const revealAnchor = (target = document.getElementById(id)) => {
    if (!target) return;
    currentTarget = target;
    target.scrollIntoView();
  };
  revealAnchor();

  // Route hydration can briefly expose the prerendered target before replacing
  // it with the final layout. Keep observing so the final target is revealed too.
  const observer = new window.MutationObserver(() => {
    const target = document.getElementById(id);
    if (target && target !== currentTarget) revealAnchor(target);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  let retry = 0;
  let timeout = 0;
  const cancelOnInteraction = () => {
    observer.disconnect();
    window.clearTimeout(retry);
    window.clearTimeout(timeout);
    window.removeEventListener("wheel", cancelOnInteraction);
    window.removeEventListener("pointerdown", cancelOnInteraction);
    window.removeEventListener("touchstart", cancelOnInteraction);
  };
  retry = window.setTimeout(revealAnchor, Math.min(500, timeoutMs));
  timeout = window.setTimeout(cancelOnInteraction, timeoutMs);
  window.addEventListener("wheel", cancelOnInteraction, { once: true });
  window.addEventListener("pointerdown", cancelOnInteraction, { once: true });
  window.addEventListener("touchstart", cancelOnInteraction, { once: true });

  return () => {
    cancelOnInteraction();
  };
}

function isBackendContentUrl(url: URL): boolean {
  return (
    !NON_CONTENT_BACKEND_PATHS.some((pattern) => pattern.test(url.pathname))
    && !url.searchParams.has("rest_route")
    && !url.searchParams.has("download_file")
  );
}

type SmartLinkControllerOptions = {
  document: Document;
  window: Window;
  backendOrigin?: string;
  normalizeTo?: (to: string) => string;
  navigate: (to: string) => void;
  prefetch: (to: string) => Promise<unknown> | unknown;
  intentDelay?: number;
  maxPrefetches?: number;
  maxConcurrency?: number;
  maxQueueSize?: number;
};

export function mountSmartLinkNavigation({
  document,
  window,
  backendOrigin,
  normalizeTo = (to) => to,
  navigate,
  prefetch,
  intentDelay = 80,
  maxPrefetches = 50,
  maxConcurrency = 2,
  maxQueueSize = 16,
}: SmartLinkControllerOptions): () => void {
  const scheduled = new Map<string, number>();
  const prefetched = new Set<string>();
  const queue: string[] = [];
  let active = 0;
  let disposed = false;
  const isAuthoritativePrerenderAnchor = (anchor: HTMLAnchorElement) =>
    Boolean(anchor.closest("#root.storefront-prerender-stage:not(.is-replaced)"));

  const normalizeAnchors = (root: ParentNode) => {
    const anchors = root instanceof window.HTMLAnchorElement
      ? [root]
      : [...root.querySelectorAll<HTMLAnchorElement>("a[href]")];
    for (const anchor of anchors) {
      if (
        isAuthoritativePrerenderAnchor(anchor)
        || anchor.hasAttribute(NATIVE_LINK_ATTRIBUTE)
        || anchor.hasAttribute("download")
        || anchor.rel.split(/\s+/).some((token) => token.toLowerCase() === "external")
      ) {
        continue;
      }
      const rawHref = anchor.getAttribute("href");
      if (!rawHref || rawHref.startsWith("#")) continue;
      const mapped = normalizeContentHref(rawHref, {
        storefrontOrigin: window.location.origin,
        backendOrigin,
        baseUrl: window.location.href,
      });
      if (!mapped.startsWith("/") || mapped.startsWith("//")) continue;
      const normalized = normalizeTo(mapped);
      if (normalized !== rawHref) anchor.setAttribute("href", normalized);
    }
  };
  normalizeAnchors(document);
  const anchorObserver = new window.MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof window.Element) normalizeAnchors(node);
      });
    }
  });
  anchorObserver.observe(document.documentElement, { childList: true, subtree: true });

  const classifyEventTarget = (
    target: EventTarget | null,
    allowNewContext = false,
  ): InternalLink | null => {
    const element = target as Element | null;
    if (!element || typeof element.closest !== "function") return null;
    if (element.closest('[contenteditable]:not([contenteditable="false"])')) return null;
    const anchor = element.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || isAuthoritativePrerenderAnchor(anchor)) return null;
    const classification = classifyAnchor(anchor, {
      currentUrl: window.location.href,
      storefrontOrigin: window.location.origin,
      backendOrigin,
    }, { allowNewContext });
    if (classification.kind !== "internal") return null;
    const to = normalizeTo(classification.to);
    return to === classification.to
      ? classification
      : { ...classification, url: new URL(to, window.location.origin), to };
  };

  const remember = (to: string) => {
    prefetched.delete(to);
    prefetched.add(to);
    while (prefetched.size > maxPrefetches) {
      const oldest = prefetched.values().next().value;
      if (oldest) prefetched.delete(oldest);
      else break;
    }
  };

  const drain = () => {
    if (disposed || active >= maxConcurrency) return;
    const to = queue.shift();
    if (!to) return;
    active += 1;
    remember(to);
    Promise.resolve(prefetch(to))
      .catch(() => prefetched.delete(to))
      .finally(() => {
        active -= 1;
        drain();
      });
    drain();
  };

  const requestPrefetch = (link: InternalLink, delay: number) => {
    if (
      shouldAvoidPrefetch(window.navigator)
      || prefetched.has(link.to)
      || scheduled.has(link.to)
      || queue.includes(link.to)
      || scheduled.size + queue.length + active >= maxQueueSize
    ) return;
    const timer = window.setTimeout(() => {
      scheduled.delete(link.to);
      if (disposed) return;
      queue.push(link.to);
      drain();
    }, delay);
    scheduled.set(link.to, timer);
  };

  const cancelScheduled = (link: InternalLink | null) => {
    if (!link) return;
    const timer = scheduled.get(link.to);
    if (timer === undefined) return;
    window.clearTimeout(timer);
    scheduled.delete(link.to);
  };

  const onClick = (event: MouseEvent) => {
    if (!isUnmodifiedPrimaryClick(event)) return;
    const link = classifyEventTarget(event.target);
    if (!link) return;
    event.preventDefault();
    navigate(link.to);
  };
  const onPointerOver = (event: PointerEvent) => {
    const link = classifyEventTarget(event.target, true);
    if (!link) return;
    const previous = classifyEventTarget(event.relatedTarget, true);
    if (previous?.to === link.to) return;
    requestPrefetch(link, intentDelay);
  };
  const onPointerOut = (event: PointerEvent) => {
    const link = classifyEventTarget(event.target, true);
    const next = classifyEventTarget(event.relatedTarget, true);
    if (link?.to === next?.to) return;
    cancelScheduled(link);
  };
  const onFocusIn = (event: FocusEvent) => {
    const link = classifyEventTarget(event.target, true);
    if (link) requestPrefetch(link, intentDelay);
  };
  const onFocusOut = (event: FocusEvent) => cancelScheduled(classifyEventTarget(event.target, true));
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 1 && !event.metaKey && !event.ctrlKey && !event.shiftKey) return;
    const link = classifyEventTarget(event.target, true);
    if (link) requestPrefetch(link, 0);
  };
  const onTouchStart = (event: TouchEvent) => {
    const link = classifyEventTarget(event.target, true);
    if (link) requestPrefetch(link, 0);
  };

  document.addEventListener("click", onClick);
  document.addEventListener("pointerover", onPointerOver);
  document.addEventListener("pointerout", onPointerOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("pointerdown", onPointerDown);
  document.addEventListener("touchstart", onTouchStart, { passive: true });

  return () => {
    disposed = true;
    anchorObserver.disconnect();
    scheduled.forEach((timer) => window.clearTimeout(timer));
    scheduled.clear();
    queue.length = 0;
    document.removeEventListener("click", onClick);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("touchstart", onTouchStart);
  };
}
