import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Film, Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ResponsiveImage } from "../media";
import { CommunityMediaLightbox } from "./CommunityMediaLightbox";

export type SocialPostMedia = {
  databaseId: number;
  url: string;
  mimeType: string;
  mediaType: "image" | "video";
  altText: string;
  width?: number;
  height?: number;
  srcSet?: string;
  sizes?: string;
  posterUrl?: string;
};

export type CommunityMediaGalleryProps = {
  media: SocialPostMedia[];
  title: string;
  variant?: "feed" | "detail";
  imageLoading?: "eager" | "lazy";
  aspect?: string;
  className?: string;
  fit?: "cover" | "contain-right";
  lockAspect?: boolean;
};

export function CommunityMediaGallery({
  media,
  title,
  variant = "feed",
  imageLoading = "lazy",
  aspect = "4/5",
  className = "",
  fit = "cover",
  lockAspect = false,
}: CommunityMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [generatedPoster, setGeneratedPoster] = useState<string | undefined>();
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isInViewRef = useRef(false);
  const mediaKey = media.map((item) => `${item.databaseId}:${item.url}`).join("|");
  const activeMedia = media[Math.min(activeIndex, media.length - 1)];

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
    setIsMuted(true);
    setGeneratedPoster(undefined);
    setIsLightboxOpen(false);
  }, [mediaKey]);

  useEffect(() => {
    if (media.length < 2) return;
    const adjacent = [
      media[(activeIndex + 1) % media.length],
      media[(activeIndex - 1 + media.length) % media.length],
    ];
    for (const item of adjacent) {
      if (item.mediaType !== "image") continue;
      const image = new Image();
      image.decoding = "async";
      image.src = item.url;
      if (item.srcSet) image.srcset = item.srcSet;
      image.sizes = item.sizes || "(min-width: 768px) 33vw, 100vw";
    }
  }, [activeIndex, media, mediaKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || activeMedia?.mediaType !== "video" || isLightboxOpen) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const playWhenReady = () => {
      if (!isInViewRef.current || reducedMotion) return;
      void video.play().catch((error: DOMException) => {
        if (!["AbortError", "NotAllowedError"].includes(error.name)) {
          console.warn("Viewport video autoplay failed.", error);
        }
      });
    };
    const observer = new IntersectionObserver(([entry]) => {
      const isInView = entry.isIntersecting && entry.intersectionRatio >= 0.6;
      isInViewRef.current = isInView;
      if (!isInView) {
        video.pause();
        return;
      }
      if (video.preload !== "auto") {
        video.preload = "auto";
        video.load();
      }
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) playWhenReady();
    }, { threshold: [0, 0.6, 1] });
    const handleVisibilityChange = () => {
      if (document.hidden) video.pause();
      else playWhenReady();
    };
    observer.observe(video);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      isInViewRef.current = false;
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.pause();
    };
  }, [activeMedia?.mediaType, activeMedia?.url, isLightboxOpen]);

  if (!activeMedia) return null;
  const activeAspect = !lockAspect && activeMedia.width && activeMedia.height
    ? `${activeMedia.width} / ${activeMedia.height}`
    : aspect.replace("/", " / ");
  const mediaClassName = fit === "contain-right"
    ? "block !h-full !w-full max-w-none object-contain object-right"
    : "block !h-full !w-full max-w-none object-cover";

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const setCurrentMedia = (index: number) => {
    videoRef.current?.pause();
    setIsPlaying(false);
    setGeneratedPoster(undefined);
    setActiveIndex(((index % media.length) + media.length) % media.length);
  };

  const selectMedia = (event: MouseEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    setCurrentMedia(index);
  };

  const openLightbox = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    videoRef.current?.pause();
    setIsLightboxOpen(true);
  };

  const handleLoadedData = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!activeMedia.posterUrl && !generatedPoster && video.videoWidth && video.videoHeight) {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        try {
          setGeneratedPoster(canvas.toDataURL("image/jpeg", 0.76));
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== "SecurityError") {
            console.warn("Video poster generation failed.", error);
          }
        }
      }
    }
    if (isInViewRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void video.play().catch((error: DOMException) => {
        if (!["AbortError", "NotAllowedError"].includes(error.name)) {
          console.warn("Viewport video autoplay failed.", error);
        }
      });
    }
  };

  return (
    <div className={`sf-media-gallery grid gap-2 ${className}`}>
      <div
        className={`relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${variant === "detail" ? "rounded-3xl shadow-soft" : ""}`}
        style={lockAspect ? undefined : { aspectRatio: activeAspect }}
      >
        {activeMedia.mediaType === "video" ? (
          <video
            ref={videoRef}
            key={activeMedia.url}
            aria-label={activeMedia.altText || title}
            controls={variant === "detail"}
            muted={isMuted}
            poster={activeMedia.posterUrl || generatedPoster}
            width={activeMedia.width}
            height={activeMedia.height}
            onLoadedData={handleLoadedData}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
            playsInline
            preload="none"
            className={`block !h-full !w-full max-w-none bg-black object-center ${variant === "feed" ? "object-cover" : "object-contain"}`}
          >
            <source src={activeMedia.url} type={activeMedia.mimeType} />
          </video>
        ) : variant === "detail" ? (
          <button
            type="button"
            onClick={openLightbox}
            aria-label={`Open ${activeMedia.altText || title} in media viewer`}
            className="group relative h-full w-full cursor-zoom-in"
          >
            <ResponsiveImage
              src={activeMedia.url}
              srcSet={activeMedia.srcSet}
              alt={activeMedia.altText || title}
              width={activeMedia.width}
              height={activeMedia.height}
              priority={imageLoading === "eager"}
              loading={imageLoading}
              sizes={activeMedia.sizes || "(min-width: 1024px) 58vw, 100vw"}
              draggable={false}
              className={mediaClassName}
            />
            <span className="pointer-events-none absolute bottom-3 right-3 inline-grid h-10 w-10 place-items-center rounded-full bg-black/55 text-white opacity-90 backdrop-blur transition group-hover:bg-black/75">
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        ) : (
          <ResponsiveImage
            src={activeMedia.url}
            srcSet={activeMedia.srcSet}
            alt={activeMedia.altText || title}
            width={activeMedia.width}
            height={activeMedia.height}
            priority={imageLoading === "eager"}
            loading={imageLoading}
            sizes={activeMedia.sizes || "(min-width: 768px) 33vw, 100vw"}
            draggable={false}
            className={mediaClassName}
          />
        )}
        {variant === "detail" && activeMedia.mediaType === "video" ? (
          <button
            type="button"
            onClick={openLightbox}
            aria-label={`Open ${activeMedia.altText || title} in media viewer`}
            className="absolute right-3 top-3 z-20 inline-grid h-10 w-10 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        {variant === "feed" && activeMedia.mediaType === "video" ? (
          <div className="absolute bottom-12 right-2 z-20 flex items-center gap-1 rounded-full bg-black/70 p-1 text-white shadow-soft backdrop-blur">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                void togglePlayback();
              }}
              className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleMuted();
              }}
              className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        ) : null}
        {variant === "feed" && media.length > 1 ? (
          <div className="absolute right-2 top-2 z-20 rounded-full bg-black/70 px-2 py-1 text-[0.65rem] font-semibold text-white" aria-live="polite">
            {activeIndex + 1}/{media.length}
          </div>
        ) : null}
        {variant === "feed" && media.length > 1 ? (
          <>
            <button
              type="button"
              onClick={(event) => selectMedia(event, activeIndex - 1)}
              aria-label="Previous media"
              className="absolute left-2 top-1/2 z-20 inline-grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-soft backdrop-blur transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(event) => selectMedia(event, activeIndex + 1)}
              aria-label="Next media"
              className="absolute right-2 top-1/2 z-20 inline-grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/60 text-white shadow-soft backdrop-blur transition hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {media.length > 1 ? (
        <div
          className={`flex gap-2 overflow-x-auto ${variant === "detail" ? "pb-1" : "absolute left-2 top-2 w-fit max-w-[calc(100%-1rem)] rounded-full bg-black/60 p-1"}`}
          aria-label="Choose media"
        >
          {media.map((item, index) => (
            <button
              key={`${item.databaseId}:${item.url}`}
              type="button"
              aria-label={`Show media ${index + 1} of ${media.length}`}
              aria-pressed={index === activeIndex}
              onClick={(event) => selectMedia(event, index)}
              className={`relative grid shrink-0 place-items-center overflow-hidden border-2 transition ${
                variant === "detail" ? "h-16 w-16 rounded-xl" : "h-3 w-3 rounded-full"
              } ${index === activeIndex ? "border-brand-500" : "border-white/70"}`}
            >
              {variant === "detail" ? (
                item.mediaType === "video" ? (
                  <span className="grid h-full w-full place-items-center bg-zinc-900 text-white">
                    <Film className="h-5 w-5" aria-hidden="true" />
                  </span>
                ) : (
                  <ResponsiveImage src={item.url} alt="" sizes="4rem" className={`h-full w-full ${fit === "contain-right" ? "object-contain object-right" : "object-cover"}`} />
                )
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {variant === "detail" && isLightboxOpen ? (
        <CommunityMediaLightbox
          media={media}
          startIndex={activeIndex}
          title={title}
          onIndexChange={setCurrentMedia}
          onClose={() => setIsLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
