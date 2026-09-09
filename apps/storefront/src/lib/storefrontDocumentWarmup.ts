const warmedDocuments = new Map<string, Promise<void>>();
const warmedAssets = new Map<string, Promise<void>>();
export const artifactRouteHydrationEnabled = import.meta.env.VITE_ARTIFACT_ROUTE_HYDRATION === "true";

declare global {
  interface Window {
    __funkyStorefrontHydrationSeed?: (payload: unknown) => unknown;
    __funkyStorefrontPendingHydration?: unknown[];
  }
}

function queueStorefrontHydration(payload: unknown): void {
  if (window.__funkyStorefrontHydrationSeed) {
    window.__funkyStorefrontHydrationSeed(payload);
    return;
  }
  (window.__funkyStorefrontPendingHydration ??= []).push(payload);
}

function storefrontDocumentUrl(to: string): URL | null {
  try {
    const url = new URL(to, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function warmStorefrontDocument(to: string): Promise<void> {
  const url = storefrontDocumentUrl(to);
  if (!url) return Promise.resolve();

  const key = `${url.pathname}${url.search}`;
  const existing = warmedDocuments.get(key);
  if (existing) return existing;

  const warmup = fetch(key, {
    method: "GET",
    credentials: "same-origin",
    headers: { Accept: "text/html" },
  }).then(async (response) => {
    if (!response.ok) return;
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    if (artifactRouteHydrationEnabled) {
      const routePayload = parsed.querySelector<HTMLScriptElement>(
        "#storefront-route-payload",
      )?.textContent;
      if (routePayload) {
        try {
          queueStorefrontHydration(JSON.parse(routePayload));
        } catch (error) {
          console.warn("Artifact hydration failed.", error);
        }
      }
    }
    const hydrationManifest = parsed.querySelector<HTMLScriptElement>(
      '#storefront-static-hydration-assets[type="application/json"]',
    )?.textContent;
    if (hydrationManifest) {
      try {
        const hydrationAssets = JSON.parse(hydrationManifest) as unknown;
        if (Array.isArray(hydrationAssets)) {
          const loadHydrationAsset = async (asset: unknown) => {
            if (typeof asset !== "string" || !asset.startsWith("/assets/")) return;
            const assetUrl = new URL(asset, url);
            if (assetUrl.origin !== window.location.origin) return;
            try {
              const hydrationResponse = await fetch(assetUrl.href, {
                credentials: "omit",
                signal: AbortSignal.timeout(2_000),
              });
              if (!hydrationResponse.ok) return;
              queueStorefrontHydration(await hydrationResponse.json());
            } catch (error) {
              console.warn(`Target-route hydration asset could not be loaded: ${assetUrl.pathname}`, error);
            }
          };
          const boundedAssets = hydrationAssets.slice(0, 12);
          const routeAssets = boundedAssets.filter(
            (asset) => typeof asset === "string" && asset.includes("/storefront-hydration-route-"),
          );
          const supportingAssets = boundedAssets.filter((asset) => !routeAssets.includes(asset));
          await Promise.all(routeAssets.map(loadHydrationAsset));
          void Promise.all(supportingAssets.map(loadHydrationAsset));
        }
      } catch (error) {
        console.warn("Target-route hydration manifest could not be parsed.", error);
      }
    }
    const assets = [...parsed.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"][href], link[rel="preload"][as="style"][href], link[rel="preload"][as="font"][href]',
    )].flatMap((link) => {
      try {
        const href = link.getAttribute("href");
        if (!href) return [];
        const assetUrl = new URL(href, url);
        if (assetUrl.origin !== window.location.origin) return [];
        return [{ href: assetUrl.href, font: link.getAttribute("as") === "font" }];
      } catch {
        return [];
      }
    });
    const uniqueAssets = [...new Map(assets.map((asset) => [asset.href, asset])).values()].slice(0, 12);
    void Promise.all(uniqueAssets.map(({ href, font }) => {
      const existingAsset = warmedAssets.get(href);
      if (existingAsset) return existingAsset;
      const assetWarmup = fetch(href, font
        ? { mode: "cors", credentials: "omit" }
        : { credentials: "same-origin" }).then(() => undefined).catch(() => undefined);
      warmedAssets.set(href, assetWarmup);
      return assetWarmup;
    }));
  }).catch(() => undefined);

  warmedDocuments.set(key, warmup);
  return warmup;
}

function internalDocumentLink(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null;
  const link = target.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.download || link.rel.split(/\s+/).includes("external")) return null;
  return storefrontDocumentUrl(link.href) ? link : null;
}

export function installStaticDocumentWarmup(root: HTMLElement): () => void {
  const warmFromIntent = (event: Event) => {
    const link = internalDocumentLink(event.target);
    if (link) void warmStorefrontDocument(link.href);
  };
  root.addEventListener("pointerover", warmFromIntent, { passive: true });
  root.addEventListener("pointerdown", warmFromIntent, { passive: true });
  root.addEventListener("touchstart", warmFromIntent, { passive: true });
  root.addEventListener("focusin", warmFromIntent);

  return () => {
    root.removeEventListener("pointerover", warmFromIntent);
    root.removeEventListener("pointerdown", warmFromIntent);
    root.removeEventListener("touchstart", warmFromIntent);
    root.removeEventListener("focusin", warmFromIntent);
  };
}
