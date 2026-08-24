import "./styles.css";
import { activatePrerenderImages } from "./lib/prerenderImages";
import { captureInitialCmsPageMarkup } from "./lib/prerenderSnapshot";
import { installStaticDocumentWarmup } from "./lib/storefrontDocumentWarmup";
import { startRecentOrdersNotifier } from "./lib/recentOrders";

let hasMounted = false;
const initialRoot = document.getElementById("root")!;
const bootstrapOverlay = document.getElementById("storefront-bootstrap");
const bootstrapStartedAt = performance.now();
const hasPrerenderedContent = Boolean(initialRoot.querySelector("#prerendered-storefront"));
const hasPrerenderedChrome = Boolean(initialRoot.querySelector("[data-prerendered-chrome]"));
const prerenderedChrome = initialRoot.querySelector<HTMLElement>("[data-prerendered-chrome]");
const MIN_BOOTSTRAP_MS = hasPrerenderedChrome ? 0 : 320;
const FONT_SETTLE_TIMEOUT_MS = 600;
const RELOAD_FONT_SETTLE_TIMEOUT_MS = 3_000;
const SCROLL_RELOAD_STATE_KEY = "storefront:scroll-reload-state";
const prerenderRoot = hasPrerenderedContent ? initialRoot : null;
const isFlagshipStorefront = (() => {
  try {
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim() || location.origin;
    const isFlagshipRuntime = location.hostname === "superfunky.pro"
      || location.hostname === "superfunky.netlify.app"
      || location.hostname.endsWith("--superfunky.netlify.app")
      || location.hostname === "127.0.0.1"
      || location.hostname === "localhost";
    return isFlagshipRuntime
      && new URL(configuredSiteUrl, location.origin).hostname === "superfunky.pro";
  } catch {
    return location.hostname === "superfunky.pro";
  }
})();
const isManagedStorefront = (() => {
  try {
    const configuredSiteUrl = import.meta.env.VITE_SITE_URL?.trim() || location.origin;
    const configuredHostname = new URL(configuredSiteUrl, location.origin).hostname;
    const configuredBackendHostname = new URL(
      import.meta.env.VITE_GRAPHQL_ENDPOINT?.trim() || location.origin,
      location.origin,
    ).hostname;
    const isManagedConfiguration = configuredHostname === "superfunky.pro"
      || configuredHostname.endsWith(".superfunky.pro")
      || configuredBackendHostname === "superfunky.pro"
      || configuredBackendHostname.endsWith(".superfunky.pro");
    const isManagedRuntime = location.hostname === "superfunky.pro"
      || location.hostname.endsWith(".superfunky.pro")
      || location.hostname === "127.0.0.1"
      || location.hostname === "localhost"
      || location.hostname.endsWith(".netlify.app");
    return isManagedConfiguration && isManagedRuntime;
  } catch {
    return location.hostname === "superfunky.pro"
      || location.hostname.endsWith(".superfunky.pro");
  }
})();
let root = initialRoot;
let bootstrapFinished = false;
let overlayFinished = false;
let reactShellRevealed = false;
let reactVisibleReady = false;
let reactShellReady = false;
let activationRequested = false;
let activationScrollY = 0;
let activationShortcodeAnchor: {
  name: string;
  index: number;
  viewportTop: number;
} | null = null;
let failOpenTimer = 0;
let coherenceWarningTimer = 0;
let activationStatusTimer = 0;
let waitingControl: HTMLElement | null = null;
let interactionLoader: HTMLElement | null = null;
let pendingLanguageSwitcherActivation = false;
let pendingControlActivation: {
  storefrontControl: string;
  tagName: string;
  id: string;
  name: string;
  ariaLabel: string;
  text: string;
} | null = null;
let dynamicHydrationObserver: IntersectionObserver | null = null;
let stopPrerenderImageLoading: () => void = () => undefined;
let stopStaticDocumentWarmup: () => void = () => undefined;
let stopStaticSubmenus: () => void = () => undefined;
let stopStaticMobileNavigation: () => void = () => undefined;
let stopStaticHeaderBehavior: () => void = () => undefined;
let stopStaticCmsBehaviors: () => void = () => undefined;
declare global {
  interface Window {
    __funkyStorefrontStaticNavigation?: {
      container: HTMLElement;
      cleanup: () => void;
    };
  }
}
const preparationEvents = ["pointerover", "focusin", "pointerdown", "keydown", "touchstart"] as const;
const domReady = document.readyState === "loading"
  ? new Promise<void>((resolve) => document.addEventListener("DOMContentLoaded", () => resolve(), { once: true }))
  : Promise.resolve();
const initialFontsReady = document.fonts.status === "loaded"
  ? Promise.resolve()
  : new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(fontTimer);
        resolve();
      };
      const fontTimer = window.setTimeout(() => {
        console.warn("Storefront fonts are delayed; continuing with configured fallback fonts.");
        finish();
      }, FONT_SETTLE_TIMEOUT_MS);
      void document.fonts.ready.then(finish);
    });
const initialVisualsReady = Promise.all([domReady, initialFontsReady]);
if (prerenderedChrome?.dataset.recentOrdersEnabled === "true") {
  const endpoint = new URL(
    "/wp-json/funkycommerce/v1/recent-orders",
    import.meta.env.VITE_GRAPHQL_ENDPOINT?.trim() || location.origin,
  ).toString();
  void startRecentOrdersNotifier({
      enabled: true,
      itemCount: Number(prerenderedChrome.dataset.recentOrdersCount),
      intervalSeconds: Number(prerenderedChrome.dataset.recentOrdersInterval),
      endpoint,
    })
    .catch((error) => {
      console.error("Recent-order notifications could not start.", error);
    });
}
const currentDocumentKey = `${location.pathname}${location.search}${location.hash}`;
let savedReloadScrollY = 0;
try {
  const savedState = JSON.parse(sessionStorage.getItem(SCROLL_RELOAD_STATE_KEY) || "null") as {
    documentKey?: unknown;
    scrollY?: unknown;
  } | null;
  if (savedState?.documentKey === currentDocumentKey && typeof savedState.scrollY === "number") {
    savedReloadScrollY = Math.max(0, savedState.scrollY);
  }
} catch (error) {
  console.warn("Storefront reload scroll state could not be read.", error);
}
window.addEventListener("pagehide", () => {
  try {
    sessionStorage.setItem(SCROLL_RELOAD_STATE_KEY, JSON.stringify({
      documentKey: currentDocumentKey,
      scrollY: window.scrollY,
    }));
  } catch (error) {
    console.warn("Storefront reload scroll state could not be saved.", error);
  }
});
const navigationEntry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
if (
  prerenderRoot
  && navigationEntry?.type === "reload"
  && savedReloadScrollY > 0
  && document.fonts.status !== "loaded"
) {
  document.documentElement.classList.add("storefront-scroll-restore-pending");
  const reloadStatus = document.createElement("div");
  reloadStatus.className = "storefront-scroll-reload-status";
  reloadStatus.setAttribute("role", "status");
  reloadStatus.setAttribute("aria-live", "polite");
  reloadStatus.innerHTML = '<span aria-hidden="true"></span><strong>Restoring your place</strong>';
  document.body.append(reloadStatus);
  const reloadFontsReady = Promise.race([
    document.fonts.ready,
    new Promise<void>((resolve) => window.setTimeout(resolve, RELOAD_FONT_SETTLE_TIMEOUT_MS)),
  ]);
  void reloadFontsReady.then(() => {
    const revealRestoredViewport = () => {
      window.scrollTo({ top: savedReloadScrollY, behavior: "auto" });
      document.documentElement.classList.remove("storefront-scroll-restore-pending");
      reloadStatus.remove();
    };
    if (document.visibilityState === "hidden") {
      revealRestoredViewport();
    } else {
      requestAnimationFrame(revealRestoredViewport);
    }
  });
}
const loadStaticHydrationPayloads = () => {
  const serialized = document.getElementById("storefront-static-hydration-assets")?.textContent;
  if (!serialized) return Promise.resolve([]);
  let urls: unknown;
  try {
    urls = JSON.parse(serialized);
  } catch (error) {
    console.error("Storefront static hydration asset list could not be parsed.", error);
    return Promise.resolve([]);
  }
  if (!Array.isArray(urls) || !urls.every((url) => typeof url === "string" && url.startsWith("/assets/"))) {
    console.error("Storefront static hydration asset list was rejected.");
    return Promise.resolve([]);
  }
  return Promise.all(urls.map(async (url) => {
    try {
      const response = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(2_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as unknown;
    } catch (error) {
      console.error(`Storefront static hydration asset was unavailable: ${url}`, error);
      return null;
    }
  })).then((payloads) => payloads.filter((payload) => payload !== null));
};

captureInitialCmsPageMarkup(
  initialRoot.querySelector<HTMLElement>(
    "#prerendered-storefront [data-cms-page]:not([data-prerendered-cms-snapshot]) > .wp-site-blocks",
  )?.innerHTML || "",
);
if (prerenderRoot) {
  prerenderRoot.classList.add("storefront-prerender-stage");
  stopPrerenderImageLoading = activatePrerenderImages(prerenderRoot);
  stopStaticDocumentWarmup = installStaticDocumentWarmup(prerenderRoot);
  root = document.createElement("div");
  root.id = "storefront-react-root";
  root.className = "storefront-react-stage";
  prerenderRoot.after(root);
}
root.setAttribute("aria-busy", "true");
root.setAttribute("inert", "");

const dismissBootstrapOverlay = () => {
  if (overlayFinished) return;
  overlayFinished = true;
  const overlayPrerequisite = hasPrerenderedChrome ? domReady : initialVisualsReady;
  void overlayPrerequisite.then(() => {
    const delay = Math.max(0, MIN_BOOTSTRAP_MS - (performance.now() - bootstrapStartedAt));
    window.setTimeout(() => {
      bootstrapOverlay?.classList.add("is-ready");
      bootstrapOverlay?.setAttribute("aria-hidden", "true");
      window.setTimeout(() => bootstrapOverlay?.remove(), 180);
    }, delay);
  });
};

const dismissInteractionLoader = () => {
  interactionLoader?.remove();
  interactionLoader = null;
};

const showInteractionLoader = () => {
  if (interactionLoader) return;
  interactionLoader = document.createElement("div");
  interactionLoader.className = "storefront-interaction-loader";
  interactionLoader.setAttribute("role", "status");
  interactionLoader.setAttribute("aria-live", "polite");
  interactionLoader.innerHTML = '<span aria-hidden="true"></span><strong>Preparing this feature</strong>';
  document.body.append(interactionLoader);
};

const showInteractionFailure = () => {
  dismissInteractionLoader();
  interactionLoader = document.createElement("div");
  interactionLoader.className = "storefront-interaction-loader is-error";
  interactionLoader.setAttribute("role", "alert");
  interactionLoader.innerHTML = "<strong>This feature could not be loaded. Please try again.</strong>";
  document.body.append(interactionLoader);
  window.setTimeout(dismissInteractionLoader, 5_000);
};

const prepareReactShell = () => {
  root.removeAttribute("aria-busy");
  dismissBootstrapOverlay();
  if (!prerenderRoot) root.removeAttribute("inert");
};

const alignHiddenReactStage = () => {
  if (!prerenderRoot) return;
  const staticMain = prerenderRoot.querySelector<HTMLElement>("#prerendered-storefront");
  if (!staticMain) return;
  root.style.top = `${Math.max(0, window.scrollY + staticMain.getBoundingClientRect().top)}px`;
};

const revealReactShell = () => {
  if (reactShellRevealed) return;
  reactShellRevealed = true;
  const handoffScrollY = activationScrollY;
  performance.mark("storefront:handoff");
  prepareReactShell();
  if (!prerenderRoot) return;
  prerenderRoot.setAttribute("aria-hidden", "true");
  prerenderRoot.setAttribute("inert", "");
  root.classList.remove("storefront-react-stage", "is-ready");
  prerenderRoot.replaceWith(root);
  root.style.removeProperty("top");
  void root.offsetHeight;
  root.removeAttribute("inert");
  root.id = "root";
  stopPrerenderImageLoading();
  stopStaticDocumentWarmup();
  stopStaticSubmenus();
  stopStaticMobileNavigation();
  stopStaticHeaderBehavior();
  stopStaticCmsBehaviors();
  restoreHandoffScrollPosition(handoffScrollY, true);
  document.documentElement.classList.remove("storefront-instant-handoff");
  removeActivationListeners();
  queueMicrotask(() => {
    replayLanguageSwitcherActivation();
    replayControlActivation();
  });
};

const restoreHandoffScrollPosition = (targetScrollY: number, afterSwap = false) => {
  if (targetScrollY <= 0) return;
  const restore = () => {
    const anchor = activationShortcodeAnchor;
    const anchoredTarget = anchor
      ? [...document.querySelectorAll<HTMLElement>(`[data-funkycommerce-shortcode="${CSS.escape(anchor.name)}"]`)][anchor.index]
      : null;
    const nextScrollY = anchoredTarget
      ? window.scrollY + anchoredTarget.getBoundingClientRect().top - anchor!.viewportTop
      : targetScrollY;
    const changed = Math.abs(window.scrollY - nextScrollY) > 1;
    if (changed) {
      window.scrollTo({ top: nextScrollY, left: window.scrollX, behavior: "auto" });
    }
    return changed;
  };
  restore();
  if (!afterSwap) {
    requestAnimationFrame(() => requestAnimationFrame(restore));
    return;
  }
  let stopped = false;
  let resizeObserver: ResizeObserver | null = null;
  let stopTimer = 0;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    resizeObserver?.disconnect();
    clearTimeout(stopTimer);
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
      window.removeEventListener(eventName, stop);
    });
  };
  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => {
      if (!stopped) restore();
    }));
    resizeObserver.observe(root);
  }
  ["wheel", "touchstart", "pointerdown", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, stop, { passive: true, once: true });
  });
  stopTimer = setTimeout(stop, 2_000);
};

const replayLanguageSwitcherActivation = (attempt = 0) => {
  if (!pendingLanguageSwitcherActivation) return;
  const trigger = root.querySelector<HTMLButtonElement>(".sf-language-switcher > button");
  if (trigger) {
    pendingLanguageSwitcherActivation = false;
    trigger.click();
    return;
  }
  if (attempt < 10) {
    window.requestAnimationFrame(() => replayLanguageSwitcherActivation(attempt + 1));
  }
};

const replayControlActivation = (attempt = 0) => {
  const pending = pendingControlActivation;
  if (!pending) return;
  const identifiedControl = pending.storefrontControl
    ? root.querySelector<HTMLElement>(
        `[data-storefront-control="${CSS.escape(pending.storefrontControl)}"]`,
      )
    : null;
  if (
    pending.storefrontControl
    && (!identifiedControl || !identifiedControl.matches('button, a[href], input, select, textarea, [role="button"]'))
  ) {
    if (attempt < 120) {
      window.requestAnimationFrame(() => replayControlActivation(attempt + 1));
    } else {
      pendingControlActivation = null;
    }
    return;
  }
  const candidates: HTMLElement[] = identifiedControl
    ? [identifiedControl]
    : pending.id
    ? [root.querySelector<HTMLElement>(`#${CSS.escape(pending.id)}`)]
        .filter((candidate): candidate is HTMLElement => Boolean(candidate))
    : [...root.querySelectorAll<HTMLElement>(pending.tagName)];
  const target = candidates.find((candidate) =>
    candidate?.getAttribute("name") === pending.name
    && candidate.getAttribute("aria-label") === pending.ariaLabel
    && candidate.textContent?.trim() === pending.text
  ) || candidates[0];
  if (!target) {
    if (attempt < 120) {
      window.requestAnimationFrame(() => replayControlActivation(attempt + 1));
    } else {
      pendingControlActivation = null;
    }
    return;
  }
  pendingControlActivation = null;
  target?.focus({ preventScroll: true });
  target?.click();
};

const finishBootstrap = () => {
  if (bootstrapFinished) return;
  bootstrapFinished = true;
  window.clearTimeout(failOpenTimer);
  window.clearTimeout(coherenceWarningTimer);
  window.clearTimeout(activationStatusTimer);
  waitingControl?.classList.remove("storefront-control-waiting");
  waitingControl?.removeAttribute("aria-busy");
  waitingControl = null;
  dismissInteractionLoader();
  revealReactShell();
};

const finishWhenReactCoherent = () => {
  if (!reactShellReady) return;
  if (prerenderRoot) {
    if (!activationRequested) return;
    if (reactVisibleReady) finishBootstrap();
    return;
  }
  if (reactVisibleReady) finishBootstrap();
};

const requestReactActivation = (event?: Event | IdleDeadline) => {
  if (event instanceof Event) {
    const target = event.target as Element | null;
    const switcher = target?.closest(".sf-language-switcher, .storefront-static-switcher--language");
    if (switcher && prerenderRoot?.contains(switcher)) {
      pendingLanguageSwitcherActivation = true;
    } else {
      if (target?.closest("a[href]")) return;
      const interactiveTarget = target?.closest(
        'button, input, select, textarea, form, [role="button"], [role="checkbox"], [role="combobox"], [data-storefront-activate]',
      );
      if (!interactiveTarget) return;
    }
  }
  if (!activationRequested) activationScrollY = window.scrollY;
  activationRequested = true;
  alignHiddenReactStage();
  performance.mark("storefront:activation-requested");
  removePreparationListeners();
  if (event instanceof Event && event.type === "click" && waitingControl) {
    activationStatusTimer = window.setTimeout(() => {
      if (reactVisibleReady || !waitingControl) return;
      waitingControl.classList.add("storefront-control-waiting");
      waitingControl.setAttribute("aria-busy", "true");
      showInteractionLoader();
    }, 250);
  }
  if (prerenderRoot) {
    coherenceWarningTimer = window.setTimeout(() => {
      console.warn("Visible storefront coherence is delayed; preserving the prerendered storefront.", {
        shellReady: reactShellReady,
        visibleReady: reactVisibleReady,
      });
    }, 8_000);
  }
  void mountApplication();
  finishWhenReactCoherent();
};
const removePreparationListeners = () => {
  preparationEvents.forEach((eventName) => {
    window.removeEventListener(eventName, requestReactPreparation);
  });
  dynamicHydrationObserver?.disconnect();
  dynamicHydrationObserver = null;
};
const removeActivationListeners = () => {
  removePreparationListeners();
  prerenderRoot?.removeEventListener("click", activateLanguageSwitcher);
  initialRoot.removeEventListener("click", activateStaticControl, true);
};
const activateLanguageSwitcher = (event: MouseEvent) => {
  const target = event.target as Element | null;
  const switcher = target?.closest(".sf-language-switcher, .storefront-static-switcher--language");
  if (!switcher || !prerenderRoot?.contains(switcher)) return;
  event.preventDefault();
  waitingControl = switcher as HTMLElement;
  requestReactActivation(event);
};
const activateStaticControl = (event: MouseEvent) => {
  const target = event.target as Element | null;
  if (target?.closest("a[href], .sf-language-switcher, .storefront-static-switcher--language")) return;
  const control = target?.closest<HTMLElement>(
    'button, input, select, textarea, [role="button"], [role="checkbox"], [role="combobox"], [data-storefront-activate]',
  );
  if (!control) return;
  if (control.matches(
    "[data-static-submenu-toggle], [data-static-mobile-toggle], [data-static-mobile-close], [data-static-mobile-expand], [data-static-theme-toggle]",
  )) return;
  event.preventDefault();
  event.stopPropagation();
  waitingControl = control;
  pendingControlActivation = {
    storefrontControl: control.dataset.storefrontControl || control.dataset.staticControl || "",
    tagName: control.tagName.toLowerCase(),
    id: control.id,
    name: control.getAttribute("name") || "",
    ariaLabel: control.getAttribute("aria-label") || "",
    text: control.textContent?.trim() || "",
  };
  requestReactActivation(event);
};
if (prerenderRoot) {
  const criticalNavigation = window.__funkyStorefrontStaticNavigation;
  if (criticalNavigation?.container === prerenderRoot.querySelector("[data-prerendered-chrome]")) {
    stopStaticSubmenus = criticalNavigation.cleanup;
  } else {
    stopStaticSubmenus = installStaticSubmenus(prerenderRoot);
    stopStaticMobileNavigation = installStaticMobileNavigation(prerenderRoot);
    stopStaticHeaderBehavior = installStaticHeaderBehavior(prerenderRoot);
  }
  if (!isFlagshipStorefront) {
    const content = prerenderRoot.querySelector<HTMLElement>("#prerendered-storefront");
    let disposed = false;
    let idleHandle: number | null = null;
    let idleCallback: number | null = null;
    const mountBehaviors = () => {
      idleHandle = null;
      idleCallback = null;
      if (!content || disposed || activationRequested) return;
      void import("./lib/cmsBehaviors").then(({ mountCmsBehaviors }) => {
        if (disposed || activationRequested) return;
        const cleanup = mountCmsBehaviors(content);
        stopStaticCmsBehaviors = () => {
          disposed = true;
          cleanup();
          stopStaticCmsBehaviors = () => undefined;
        };
      }).catch((error) => {
        console.error("Static CMS behaviors could not be loaded.", error);
      });
    };
    if ("requestIdleCallback" in window) {
      idleCallback = window.requestIdleCallback(mountBehaviors, { timeout: 1_000 });
    } else {
      idleHandle = window.setTimeout(mountBehaviors, 250);
    }
    stopStaticCmsBehaviors = () => {
      disposed = true;
      if (idleHandle != null) window.clearTimeout(idleHandle);
      if (idleCallback != null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleCallback);
      stopStaticCmsBehaviors = () => undefined;
    };
  }
  preparationEvents.forEach((eventName) => {
    window.addEventListener(eventName, requestReactPreparation, { passive: true });
  });
  prerenderRoot.addEventListener("click", activateLanguageSwitcher);
  initialRoot.addEventListener("click", activateStaticControl, true);
  const dynamicSections = [...prerenderRoot.querySelectorAll<HTMLElement>('[data-prerendered-shortcode]')]
    .filter((section) =>
      section.matches('[role="status"][aria-label^="Loading"]')
      || section.querySelector('[role="status"][aria-label^="Loading"]')
    );
  if (!isFlagshipStorefront && dynamicSections.length && "IntersectionObserver" in window) {
    const observeDynamicSections = () => {
      if (activationRequested || dynamicHydrationObserver) return;
      const observer = new IntersectionObserver((entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (!visibleEntry) return;
        const section = visibleEntry.target as HTMLElement;
        const name = section.dataset.prerenderedShortcode || "";
        const matchingSections = dynamicSections.filter((candidate) => candidate.dataset.prerenderedShortcode === name);
        activationShortcodeAnchor = {
          name,
          index: Math.max(0, matchingSections.indexOf(section)),
          viewportTop: section.getBoundingClientRect().top,
        };
        observer.disconnect();
        if (dynamicHydrationObserver === observer) dynamicHydrationObserver = null;
        requestReactActivation();
      }, { rootMargin: "200px 0px" });
      dynamicHydrationObserver = observer;
      dynamicSections.forEach((section) => observer.observe(section));
    };
    observeDynamicSections();
  }
  if (prerenderRoot.querySelector('[data-generated-route-snapshot][data-route-type$="Product"]')) {
    window.requestAnimationFrame(() => requestReactActivation());
  }

  function installStaticHeaderBehavior(container: HTMLElement): () => void {
    const header = container.querySelector<HTMLElement>(".storefront-static-header");
    const spacer = container.querySelector<HTMLElement>("[data-static-header-spacer]");
    if (!header || !spacer) return () => undefined;

    const updateHeight = () => {
      const measuredHeight = `${header.getBoundingClientRect().height}px`;
      spacer.style.setProperty("--storefront-static-header-height", measuredHeight);
      header.style.setProperty("--storefront-static-header-height", measuredHeight);
    };
    let announcementTimer = 0;
    const updateAnnouncement = () => {
      const shouldCollapse = header.dataset.staticAnnouncementScroll !== "false" && window.scrollY > 4;
      header.classList.toggle("is-announcement-collapsed", shouldCollapse);
      window.clearTimeout(announcementTimer);
      requestAnimationFrame(updateHeight);
      announcementTimer = window.setTimeout(updateHeight, 320);
    };
    const observer = "ResizeObserver" in window
      ? new ResizeObserver(() => requestAnimationFrame(updateHeight))
      : null;
    observer?.observe(header);
    updateAnnouncement();
    updateHeight();
    window.addEventListener("scroll", updateAnnouncement, { passive: true });
    window.addEventListener("resize", updateHeight, { passive: true });

    return () => {
      observer?.disconnect();
      window.clearTimeout(announcementTimer);
      window.removeEventListener("scroll", updateAnnouncement);
      window.removeEventListener("resize", updateHeight);
    };
  }

  function installStaticMobileNavigation(container: HTMLElement): () => void {
    const toggle = container.querySelector<HTMLButtonElement>("[data-static-mobile-toggle]");
    const backdrop = container.querySelector<HTMLElement>("[data-static-mobile-backdrop]");
    const drawer = container.querySelector<HTMLElement>(".storefront-static-mobile-drawer");
    if (!toggle || !backdrop || !drawer) return () => undefined;

    const closeButton = drawer.querySelector<HTMLButtonElement>("[data-static-mobile-close]");
    let restoreFocus: HTMLElement | null = null;
    let scrollY = 0;
    const previousBodyStyle = {
      position: "",
      top: "",
      left: "",
      right: "",
      width: "",
    };
    const focusableSelector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const open = () => {
      restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : toggle;
      scrollY = window.scrollY;
      const { style } = document.body;
      previousBodyStyle.position = style.position;
      previousBodyStyle.top = style.top;
      previousBodyStyle.left = style.left;
      previousBodyStyle.right = style.right;
      previousBodyStyle.width = style.width;
      style.position = "fixed";
      style.top = `-${scrollY}px`;
      style.left = "0";
      style.right = "0";
      style.width = "100%";
      backdrop.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      requestAnimationFrame(() => (closeButton || drawer).focus({ preventScroll: true }));
    };
    const close = () => {
      if (backdrop.hidden) return;
      backdrop.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      const { style } = document.body;
      style.position = previousBodyStyle.position;
      style.top = previousBodyStyle.top;
      style.left = previousBodyStyle.left;
      style.right = previousBodyStyle.right;
      style.width = previousBodyStyle.width;
      window.scrollTo({ top: scrollY, behavior: "auto" });
      restoreFocus?.focus({ preventScroll: true });
    };
    const handleToggle = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (backdrop.hidden) open();
      else close();
    };
    const handleBackdropClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const expand = target?.closest<HTMLButtonElement>("[data-static-mobile-expand]");
      if (expand && drawer.contains(expand)) {
        const children = document.getElementById(expand.getAttribute("aria-controls") || "");
        if (!children) return;
        const expanded = expand.getAttribute("aria-expanded") === "true";
        expand.setAttribute("aria-expanded", String(!expanded));
        children.hidden = expanded;
        return;
      }
      if (target?.closest("[data-static-mobile-close]") || target === backdrop) close();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      if (backdrop.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(focusableSelector)]
        .filter((element) => !element.closest<HTMLElement>("[hidden]"));
      if (!focusable.length) {
        event.preventDefault();
        drawer.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    toggle.addEventListener("click", handleToggle);
    backdrop.addEventListener("click", handleBackdropClick);
    document.addEventListener("keydown", handleKeydown);
    return () => {
      if (!backdrop.hidden) close();
      toggle.removeEventListener("click", handleToggle);
      backdrop.removeEventListener("click", handleBackdropClick);
      document.removeEventListener("keydown", handleKeydown);
    };
  }

  function installStaticSubmenus(container: HTMLElement): () => void {
    let closeTimer = 0;
    const openItem = (item: HTMLElement) => {
      clearTimeout(closeTimer);
      closeAll(item);
      item.classList.add("is-open");
      const submenu = item.querySelector<HTMLElement>(".storefront-static-submenu");
      if (submenu) {
        const viewportPadding = 16;
        const itemRect = item.getBoundingClientRect();
        const submenuRect = submenu.getBoundingClientRect();
        const maxWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
        const width = Math.min(submenuRect.width, maxWidth);
        const left = Math.max(
          viewportPadding,
          Math.min(itemRect.left, window.innerWidth - width - viewportPadding),
        );
        submenu.style.setProperty("--storefront-static-submenu-left", `${left - itemRect.left}px`);
        submenu.style.setProperty("--storefront-static-submenu-max-width", `${maxWidth}px`);
        submenu.style.setProperty(
          "--storefront-static-submenu-max-height",
          `${Math.max(0, window.innerHeight - itemRect.bottom - 8 - viewportPadding)}px`,
        );
      }
      item.querySelector<HTMLElement>("[data-static-submenu-toggle]")?.setAttribute("aria-expanded", "true");
      submenu?.setAttribute("aria-hidden", "false");
    };
    const closeAll = (except?: HTMLElement) => {
      container.querySelectorAll<HTMLElement>(".storefront-static-nav-item.is-open").forEach((item) => {
        if (item === except) return;
        item.classList.remove("is-open");
        const submenu = item.querySelector<HTMLElement>(".storefront-static-submenu");
        submenu?.style.removeProperty("--storefront-static-submenu-left");
        submenu?.style.removeProperty("--storefront-static-submenu-max-width");
        submenu?.style.removeProperty("--storefront-static-submenu-max-height");
        item.querySelector<HTMLElement>("[data-static-submenu-toggle]")?.setAttribute("aria-expanded", "false");
        submenu?.setAttribute("aria-hidden", "true");
      });
    };
    const handleClick = (event: MouseEvent) => {
      const toggle = (event.target as Element | null)?.closest<HTMLElement>("[data-static-submenu-toggle]");
      if (!toggle || !container.contains(toggle)) return;
      event.preventDefault();
      event.stopPropagation();
      const item = toggle.closest<HTMLElement>(".storefront-static-nav-item");
      if (!item) return;
      if (item.classList.contains("is-open") && item.dataset.openedByClick === "true") {
        closeAll();
        return;
      }
      openItem(item);
      item.dataset.openedByClick = "true";
    };
    const handlePointerOver = (event: PointerEvent) => {
      const item = (event.target as Element | null)?.closest<HTMLElement>(".storefront-static-nav-item");
      if (!item?.querySelector(".storefront-static-submenu")) return;
      if (!item.classList.contains("is-open")) delete item.dataset.openedByClick;
      openItem(item);
    };
    const handlePointerOut = (event: PointerEvent) => {
      const item = (event.target as Element | null)?.closest<HTMLElement>(".storefront-static-nav-item.is-open");
      if (!item || (event.relatedTarget instanceof Node && item.contains(event.relatedTarget))) return;
      clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => closeAll(), 150);
    };
    const handleFocusIn = (event: FocusEvent) => {
      const item = (event.target as Element | null)?.closest<HTMLElement>(".storefront-static-nav-item");
      if (item?.querySelector(".storefront-static-submenu")) openItem(item);
    };
    const handleOutsidePointer = (event: Event) => {
      if ((event.target as Element | null)?.closest?.(".storefront-static-nav-item")) return;
      closeAll();
    };
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const toggle = target?.closest<HTMLElement>("[data-static-submenu-toggle]");
      const openItemElement = target?.closest<HTMLElement>(".storefront-static-nav-item.is-open");
      if (event.key === "Escape") {
        const activeToggle = openItemElement?.querySelector<HTMLElement>("[data-static-submenu-toggle]");
        closeAll();
        activeToggle?.focus({ preventScroll: true });
        return;
      }
      if (toggle && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        const item = toggle.closest<HTMLElement>(".storefront-static-nav-item");
        if (!item) return;
        event.preventDefault();
        openItem(item);
        const menuItems = [...item.querySelectorAll<HTMLElement>('.storefront-static-submenu [role="menuitem"]')];
        const next = event.key === "ArrowDown" ? menuItems[0] : menuItems[menuItems.length - 1];
        next?.focus();
        return;
      }
      if (!openItemElement || !target?.matches('[role="menuitem"]')) return;
      const menuItems = [...openItemElement.querySelectorAll<HTMLElement>('.storefront-static-submenu [role="menuitem"]')];
      const currentIndex = menuItems.indexOf(target);
      const nextIndex = event.key === "ArrowDown"
        ? Math.min(menuItems.length - 1, currentIndex + 1)
        : event.key === "ArrowUp"
          ? Math.max(0, currentIndex - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? menuItems.length - 1
              : -1;
      if (nextIndex < 0) return;
      event.preventDefault();
      menuItems[nextIndex]?.focus();
    };
    const updateOpenSubmenu = () => {
      const item = container.querySelector<HTMLElement>(".storefront-static-nav-item.is-open");
      if (item) openItem(item);
    };
    container.addEventListener("click", handleClick);
    container.addEventListener("pointerover", handlePointerOver);
    container.addEventListener("pointerout", handlePointerOut);
    container.addEventListener("focusin", handleFocusIn);
    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", updateOpenSubmenu, { passive: true });
    return () => {
      clearTimeout(closeTimer);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("pointerover", handlePointerOver);
      container.removeEventListener("pointerout", handlePointerOut);
      container.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", updateOpenSubmenu);
    };
  }
}
if (hasPrerenderedChrome) {
  dismissBootstrapOverlay();
}
window.addEventListener("funky:storefront-visible-ready", () => {
  reactVisibleReady = true;
  finishWhenReactCoherent();
}, { once: true });
window.addEventListener("funky:storefront-shell-ready", () => {
  reactShellReady = true;
  finishWhenReactCoherent();
}, { once: true });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) finishWhenReactCoherent();
});

const mountApplication = async () => {
  if (hasMounted) return;
  hasMounted = true;
  if (!prerenderRoot) failOpenTimer = window.setTimeout(finishBootstrap, 2_800);
  try {
    const { React, ReactDOM, App } = await prepareApplication();
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
    performance.mark("storefront:application-render-requested");
    void import("./lib/push").then(({ registerServiceWorker }) => registerServiceWorker());
  } catch (error) {
    window.clearTimeout(failOpenTimer);
    window.clearTimeout(coherenceWarningTimer);
    window.clearTimeout(activationStatusTimer);
    waitingControl?.classList.remove("storefront-control-waiting");
    waitingControl?.removeAttribute("aria-busy");
    waitingControl = null;
    showInteractionFailure();
    if (prerenderRoot) {
      stopPrerenderImageLoading();
      root.remove();
      removeActivationListeners();
      dismissBootstrapOverlay();
    } else {
      finishBootstrap();
    }
    console.error("Storefront bootstrap failed; preserving prerendered content.", error);
  }
};

const RETURNING_PREPARATION_KEY = "storefront:application-prepared";
const COLD_DESKTOP_ACTIVATION_DELAY_MS = 2_500;
let applicationPreparation: ReturnType<typeof loadApplication> | null = null;
function loadApplication() {
  const hydrationPayloads = loadStaticHydrationPayloads();
  return Promise.all([
    import("react"),
    import("react-dom/client"),
    import("./App"),
    import("@funky/sdk/react"),
    hydrationPayloads,
  ]).then(([{ default: React }, ReactDOM, { App }, incrementalData, payloads]) => {
    for (const payload of payloads) incrementalData.seedStorefrontHydration(payload);
    const artifactPayload = document.getElementById("storefront-route-payload")?.textContent;
    if (artifactPayload) {
      try {
        incrementalData.seedStorefrontHydration(JSON.parse(artifactPayload));
      } catch (error) {
        console.error("Storefront artifact payload could not be parsed.", error);
      }
    }
    performance.mark("storefront:application-imported");
    try {
      localStorage.setItem(RETURNING_PREPARATION_KEY, "1");
    } catch {
      // Storage may be unavailable in private or restricted browsing contexts.
    }
    return { React, ReactDOM, App };
  });
}
const prepareApplication = () => {
  applicationPreparation ??= loadApplication().catch((error) => {
    applicationPreparation = null;
    throw error;
  });
  return applicationPreparation;
};
const scheduleManagedStorefrontActivation = () => {
  if (window.matchMedia("(max-width: 767px)").matches) return;
  const remainingDelay = Math.max(
    0,
    COLD_DESKTOP_ACTIVATION_DELAY_MS - (performance.now() - bootstrapStartedAt),
  );
  const activateWhenStaticControlsIdle = () => {
    if (activationRequested) return;
    if (prerenderRoot?.querySelector(
      "[data-static-mobile-backdrop].is-open, .storefront-static-nav-item.is-open",
    )) {
      window.setTimeout(activateWhenStaticControlsIdle, 1_000);
      return;
    }
    const activate = () => requestReactActivation();
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(activate, { timeout: 2_000 });
    } else {
      activate();
    }
  };
  window.setTimeout(activateWhenStaticControlsIdle, remainingDelay);
};
function requestReactPreparation(event: Event) {
  const target = event.target as Element | null;
  if (target?.closest(
    "[data-static-submenu-toggle], .storefront-static-submenu, [data-static-mobile-toggle], .storefront-static-mobile-backdrop, [data-static-theme-toggle]",
  )) return;
  const interactiveTarget = target?.closest(
    'button, input, select, textarea, form, [role="button"], [role="checkbox"], [role="combobox"], [data-storefront-activate], .sf-language-switcher, .storefront-static-switcher--language',
  );
  if (!interactiveTarget || target?.closest("a[href]:not(.sf-language-switcher)")) return;
  void prepareApplication().catch((error) => {
    console.error("Storefront interaction preparation failed.", error);
  });
}

if (!prerenderRoot) {
  void mountApplication();
} else if (isManagedStorefront) {
  let hasPreparedApplicationVisit = false;
  try {
    hasPreparedApplicationVisit = localStorage.getItem(RETURNING_PREPARATION_KEY) === "1";
  } catch {
    // The first-frame path remains available when storage is restricted.
  }
  if (hasPreparedApplicationVisit) {
    document.documentElement.classList.add("storefront-instant-handoff");
    requestReactActivation();
  } else {
    scheduleManagedStorefrontActivation();
  }
} else {
  try {
    window.addEventListener("load", () => {
      if (localStorage.getItem(RETURNING_PREPARATION_KEY) === "1") {
        const prepare = () => void prepareApplication().catch((error) => {
          console.error("Storefront repeat-visit preparation failed.", error);
        });
        if ("requestIdleCallback" in window) {
          window.requestIdleCallback(prepare, { timeout: 2_000 });
        } else {
          window.setTimeout(prepare, 1_000);
        }
      }
    }, { once: true });
  } catch {
    // Static delivery remains fully functional when storage is unavailable.
  }
}
