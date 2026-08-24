import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Film, X } from "lucide-react";
import { ResponsiveImage } from "../media";
import type { SocialPostMedia } from "./CommunityMediaGallery";

export type CommunityMediaLightboxProps = {
  media: SocialPostMedia[];
  startIndex: number;
  title: string;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
};

export function CommunityMediaLightbox({
  media,
  startIndex,
  title,
  onClose,
  onIndexChange,
}: CommunityMediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const touchRef = useRef({ x: 0, y: 0, time: 0 });
  const current = media[currentIndex];

  const goTo = useCallback((index: number) => {
    const next = ((index % media.length) + media.length) % media.length;
    setCurrentIndex(next);
    onIndexChange?.(next);
  }, [media.length, onIndexChange]);

  const previousMedia = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const nextMedia = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (
        event.target instanceof HTMLElement
        && event.target.closest("video, input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      if (media.length > 1 && event.key === "ArrowRight") {
        event.preventDefault();
        nextMedia();
      } else if (media.length > 1 && event.key === "ArrowLeft") {
        event.preventDefault();
        previousMedia();
      } else if (media.length > 1 && event.key === "Home") {
        event.preventDefault();
        goTo(0);
      } else if (media.length > 1 && event.key === "End") {
        event.preventDefault();
        goTo(media.length - 1);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goTo, media.length, nextMedia, onClose, previousMedia]);

  if (!current) return null;

  const handleFocusTrap = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], video[controls], [tabindex]:not([tabindex="-1"])',
      ) || [],
    ).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
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

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    touchRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (media.length < 2 || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchRef.current.x;
    const dy = touch.clientY - touchRef.current.y;
    if (Date.now() - touchRef.current.time > 500 || Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy)) return;
    if (dx < 0) nextMedia();
    else previousMedia();
  };

  return createPortal(
    <div
      ref={dialogRef}
      className="sf-community-media-lightbox fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/95 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} media viewer`}
      onClick={(event) => {
        event.stopPropagation();
        onClose();
      }}
      onKeyDown={handleFocusTrap}
    >
      <div className="relative flex h-full w-full max-w-6xl flex-col items-center justify-center" onClick={(event) => event.stopPropagation()}>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close media viewer"
          className="absolute right-0 top-0 z-20 inline-grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={previousMedia}
              aria-label="Previous media"
              className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/60 p-4 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline-grid"
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={nextMedia}
              aria-label="Next media"
              className="absolute right-0 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-black/60 p-4 text-white transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline-grid"
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <div
          className="flex min-h-0 w-full flex-1 touch-pan-y items-center justify-center px-0 pb-3 pt-12 sm:px-16"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {current.mediaType === "video" ? (
            <video
              key={current.url}
              controls
              playsInline
              preload="metadata"
              poster={current.posterUrl}
              aria-label={current.altText || title}
              className="max-h-full max-w-full bg-black object-contain"
            >
              <source src={current.url} type={current.mimeType} />
            </video>
          ) : (
            <ResponsiveImage
              key={current.url}
              src={current.url}
              srcSet={current.srcSet}
              alt={current.altText || title}
              width={current.width}
              height={current.height}
              priority
              sizes="100vw"
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {media.length > 1 ? (
          <>
            <div className="flex items-center justify-center gap-5 pb-2 sm:hidden">
              <button
                type="button"
                onClick={previousMedia}
                aria-label="Previous media"
                className="inline-grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <span className="min-w-14 text-center text-sm font-semibold text-white" aria-live="polite">
                {currentIndex + 1} / {media.length}
              </span>
              <button
                type="button"
                onClick={nextMedia}
                aria-label="Next media"
                className="inline-grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="scrollbar-thin flex max-w-full gap-2 overflow-x-auto p-2">
              {media.map((item, index) => (
                <button
                  key={`${item.databaseId}:${item.url}`}
                  type="button"
                  onClick={() => goTo(index)}
                  aria-label={`Show media ${index + 1} of ${media.length}`}
                  aria-current={index === currentIndex}
                  className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-zinc-900 transition sm:h-16 sm:w-16 ${
                    index === currentIndex ? "ring-2 ring-brand-400 ring-offset-2 ring-offset-zinc-950" : "opacity-65 hover:opacity-100"
                  }`}
                >
                  {item.mediaType === "image" ? (
                    <ResponsiveImage src={item.url} alt="" sizes="4rem" className="h-full w-full object-cover" aria-hidden="true" />
                  ) : item.posterUrl ? (
                    <span className="relative h-full w-full">
                      <ResponsiveImage src={item.posterUrl} alt="" sizes="4rem" className="h-full w-full object-cover" aria-hidden="true" />
                      <Film className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" aria-hidden="true" />
                    </span>
                  ) : (
                    <Film className="h-5 w-5 text-white" aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
