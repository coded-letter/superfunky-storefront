import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { ProductGalleryImage } from "./ProductGallery";
import { ResponsiveImage } from "../media";

const DEFAULT_ACCENT = "from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-900";

export type ProductImageLightboxProps = {
  images: ProductGalleryImage[];
  startIndex: number;
  onClose: () => void;
  /** Keeps the gallery's own thumbnail-strip selection in sync while browsing the lightbox. */
  onIndexChange?: (index: number) => void;
};

/**
 * Full-screen image viewer ported from the legacy Gatsby prototype's
 * `components/shop/lightbox.js`: wheel/pinch zoom, drag-to-pan once zoomed, swipe
 * left/right to change image, keyboard arrows + Escape, and a thumbnail strip.
 * Since the mockups have no real photography yet, the "image" surface is the same
 * gradient placeholder block used in `ProductGallery` rather than an `<img>` — swap
 * that block for a real `<img>` once product media is wired up; the interaction layer
 * (zoom/pan/swipe/keyboard) is written against a plain element and doesn't care.
 */
export function ProductImageLightbox({ images, startIndex, onClose, onIndexChange }: ProductImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const lastPointer = useRef({ x: 0, y: 0 });
  const touchRef = useRef({ x: 0, y: 0, time: 0, pinchStart: 0, zoomStart: 1 });

  const current = images[currentIndex];

  const resetTransform = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const goTo = useCallback(
    (index: number) => {
      const next = ((index % images.length) + images.length) % images.length;
      setCurrentIndex(next);
      onIndexChange?.(next);
      resetTransform();
    },
    [images.length, onIndexChange],
  );

  const nextImage = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);
  const prevImage = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);

  // Lock page scroll while open, matching the mobile drawer's behaviour.
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") nextImage();
      if (event.key === "ArrowLeft") prevImage();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, nextImage, prevImage]);

  if (!current) return null;

  function handleWheel(event: React.WheelEvent) {
    const delta = -event.deltaY * 0.0025;
    setZoom((previous) => {
      const next = Math.min(4, Math.max(1, +(previous + delta).toFixed(3)));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (zoom <= 1) return;
    setIsPanning(true);
    lastPointer.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!isPanning) return;
    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setOffset((previous) => ({ x: previous.x + dx, y: previous.y + dy }));
  }

  function handlePointerUp(event: React.PointerEvent) {
    setIsPanning(false);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // no-op: capture may already have been released by the browser
    }
  }

  function handleTouchStart(event: React.TouchEvent) {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      touchRef.current.x = touch.clientX;
      touchRef.current.y = touch.clientY;
      touchRef.current.time = Date.now();
    } else if (event.touches.length === 2) {
      const [a, b] = [event.touches[0], event.touches[1]];
      touchRef.current.pinchStart = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      touchRef.current.zoomStart = zoom;
    }
  }

  function handleTouchMove(event: React.TouchEvent) {
    if (event.touches.length === 2 && touchRef.current.pinchStart) {
      const [a, b] = [event.touches[0], event.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const scale = distance / touchRef.current.pinchStart;
      const nextZoom = Math.min(4, Math.max(1, touchRef.current.zoomStart * scale));
      setZoom(nextZoom);
      if (nextZoom === 1) setOffset({ x: 0, y: 0 });
    }
  }

  function handleTouchEnd(event: React.TouchEvent) {
    if (zoom > 1 || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchRef.current.x;
    const dt = Date.now() - touchRef.current.time;
    if (dt < 300 && Math.abs(dx) > 60) {
      if (dx < 0) nextImage();
      else prevImage();
    }
  }

  return createPortal(
    <div
      className="sf-product-lightbox funky-product-image-lightbox fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/90 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      onClick={onClose}
    >
      <div className="relative flex w-full max-w-5xl flex-col items-center" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="absolute right-0 top-0 z-10 inline-grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {images.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prevImage}
              aria-label="Previous image"
              className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white shadow-lg transition hover:bg-black/70 sm:left-4 sm:flex sm:p-4"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              aria-label="Next image"
              className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/50 p-3 text-white shadow-lg transition hover:bg-black/70 sm:right-4 sm:flex sm:p-4"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <div
          className="relative flex max-h-[75vh] w-full max-w-3xl touch-none items-center justify-center overflow-hidden rounded-2xl"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className={`grid aspect-square w-full select-none place-items-center overflow-hidden bg-gradient-to-br shadow-soft-lg ${current.accentClass ?? DEFAULT_ACCENT}`}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transition: isPanning ? "none" : "transform 140ms ease-out",
              cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "zoom-in",
            }}
          >
            {current.src ? (
              <ResponsiveImage
                src={current.src}
                alt={current.alt || current.label}
                priority
                sizes="(min-width: 768px) 48rem, 100vw"
                draggable={false}
                className="block h-full w-full object-contain"
              />
            ) : (
              <span className="px-4 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">{current.label}</span>
            )}
          </div>
        </div>

        {/* Mobile-only prev/next row: the side-overlay arrows above cover too much of the
            image on narrow screens, so on mobile they move here, below it, instead. */}
        {images.length > 1 ? (
          <div className="mt-4 flex w-full items-center justify-center gap-4 sm:hidden">
            <button
              type="button"
              onClick={prevImage}
              aria-label="Previous image"
              className="inline-grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white shadow-lg transition hover:bg-black/70"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              aria-label="Next image"
              className="inline-grid h-11 w-11 place-items-center rounded-full bg-black/50 text-white shadow-lg transition hover:bg-black/70"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {images.length > 1 ? (
          <div className="scrollbar-thin mt-4 flex w-full justify-center gap-3 overflow-x-auto p-2 pt-3">
            {images.map((image, index) => {
              const isActive = index === currentIndex;
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show ${image.label}`}
                  aria-current={isActive}
                  className={`grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br shadow-soft transition sm:h-20 sm:w-20 ${
                    image.accentClass ?? DEFAULT_ACCENT
                  } ${isActive ? "scale-105 ring-2 ring-brand-400" : "opacity-70 hover:opacity-100"}`}
                >
                  {image.src ? (
                    <ResponsiveImage src={image.src} alt="" sizes="5rem" className="block h-full w-full object-cover" aria-hidden="true" />
                  ) : (
                    <span className="px-1 text-center text-[0.6rem] font-medium text-zinc-600 dark:text-zinc-300">{image.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
