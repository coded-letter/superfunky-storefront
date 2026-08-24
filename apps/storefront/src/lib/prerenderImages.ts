const PRERENDER_IMAGE_MARGIN = "100% 0px";

export function activatePrerenderImages(root: HTMLElement): () => void {
  const deferredImages = Array.from(
    root.querySelectorAll<HTMLImageElement>("img[data-prerender-src]"),
  );
  const view = root.ownerDocument.defaultView;
  const ImageElement = view?.HTMLImageElement;
  const handleError = (event: Event) => {
    if (!ImageElement || !(event.target instanceof ImageElement)) return;
    restorePrerenderFallback(event.target);
  };
  root.addEventListener("error", handleError, true);
  root.querySelectorAll<HTMLImageElement>("img[src][data-prerender-fallback-src]")
    .forEach((image) => {
      if (image.complete && image.naturalWidth === 0) restorePrerenderFallback(image);
    });

  if (!view?.IntersectionObserver) {
    deferredImages.forEach((image) => restorePrerenderImage(image, false));
    return () => root.removeEventListener("error", handleError, true);
  }

  const observer = new view.IntersectionObserver((entries) => {
    let hasVisiblePriority = Array.from(
      root.querySelectorAll<HTMLImageElement>('img[src][fetchpriority="high"]'),
    ).some((image) => {
      const bounds = image.getBoundingClientRect();
      return bounds.top < view.innerHeight && bounds.bottom > 0;
    });
    entries.forEach((entry) => {
      if (!entry.isIntersecting || !ImageElement || !(entry.target instanceof ImageElement)) return;
      const image = entry.target;
      const isVisible = entry.boundingClientRect.top < view.innerHeight
        && entry.boundingClientRect.bottom > 0;
      const priority = isVisible && !hasVisiblePriority;
      restorePrerenderImage(image, priority);
      if (priority) hasVisiblePriority = true;
      observer.unobserve(image);
    });
  }, { rootMargin: PRERENDER_IMAGE_MARGIN });
  deferredImages.forEach((image) => observer.observe(image));

  return () => {
    observer.disconnect();
    root.removeEventListener("error", handleError, true);
  };
}

function restorePrerenderFallback(image: HTMLImageElement): void {
  const fallbackSource = image.dataset.prerenderFallbackSrc;
  if (!fallbackSource) return;

  delete image.dataset.prerenderFallbackSrc;
  image.removeAttribute("srcset");
  image.removeAttribute("sizes");
  image.src = fallbackSource;
}

export function restorePrerenderImage(image: HTMLImageElement, priority: boolean): void {
  const source = image.dataset.prerenderSrc;
  if (!source) return;
  const sourceSet = image.dataset.prerenderSrcset;

  if (sourceSet) image.setAttribute("srcset", sourceSet);
  image.loading = priority ? "eager" : "lazy";
  image.decoding = priority ? "sync" : "async";
  if (priority) {
    image.setAttribute("fetchpriority", "high");
  } else {
    image.removeAttribute("fetchpriority");
  }
  image.src = source;
  delete image.dataset.prerenderSrc;
  delete image.dataset.prerenderSrcset;
}
