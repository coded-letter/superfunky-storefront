const warmedDocuments = new Map<string, Promise<void>>();
const warmedAssets = new Map<string, Promise<void>>();

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
    await Promise.all(uniqueAssets.map(({ href, font }) => {
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
