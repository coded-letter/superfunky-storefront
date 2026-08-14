import { useEffect, useRef, useState } from "react";
import { Film, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { ResponsiveImage } from "../media";

export type SocialPostMedia = {
  databaseId: number;
  url: string;
  mimeType: string;
  mediaType: "image" | "video";
  altText: string;
  width?: number;
  height?: number;
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaKey = media.map((item) => `${item.databaseId}:${item.url}`).join("|");

  useEffect(() => {
    setActiveIndex(0);
    setIsPlaying(false);
    setIsMuted(true);
  }, [mediaKey]);

  if (!media.length) return null;
  const activeMedia = media[Math.min(activeIndex, media.length - 1)];
  const activeAspect = !lockAspect && activeMedia.width && activeMedia.height
    ? `${activeMedia.width} / ${activeMedia.height}`
    : aspect.replace("/", " / ");
  const mediaClassName = fit === "contain-right"
    ? "h-full w-full object-contain object-right"
    : "h-full w-full object-cover";

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

  return (
    <div className={`sf-media-gallery grid gap-2 ${className}`}>
      <div
        className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${variant === "detail" ? "rounded-3xl shadow-soft" : ""}`}
        style={{ aspectRatio: activeAspect }}
      >
        {activeMedia.mediaType === "video" ? (
          <video
            ref={videoRef}
            key={activeMedia.url}
            aria-label={activeMedia.altText || title}
            autoPlay={variant === "feed"}
            controls={variant === "detail"}
            loop={variant === "feed"}
            muted={isMuted}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onVolumeChange={(event) => setIsMuted(event.currentTarget.muted)}
            playsInline
            preload="metadata"
            className={`h-full w-full bg-black object-center ${variant === "feed" ? "object-cover" : "object-contain"}`}
          >
            <source src={activeMedia.url} type={activeMedia.mimeType} />
          </video>
        ) : (
          <ResponsiveImage
            src={activeMedia.url}
            alt={activeMedia.altText || title}
            priority={imageLoading === "eager"}
            loading={imageLoading}
            sizes={variant === "detail" ? "(min-width: 1024px) 58vw, 100vw" : "(min-width: 768px) 33vw, 100vw"}
            draggable={false}
            className={mediaClassName}
          />
        )}
        {variant === "feed" && activeMedia.mediaType === "video" ? (
          <div className="absolute bottom-12 right-2 z-20 flex items-center gap-1 rounded-full bg-black/70 p-1 text-white shadow-soft backdrop-blur">
            <button
              type="button"
              onClick={togglePlayback}
              className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={isPlaying ? "Pause video" : "Play video"}
            >
              {isPlaying ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={toggleMuted}
              className="grid h-8 w-8 place-items-center rounded-full transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label={isMuted ? "Unmute video" : "Mute video"}
            >
              {isMuted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        ) : null}
        {variant === "feed" && media.length > 1 ? (
          <div className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[0.65rem] font-semibold text-white">
            {activeIndex + 1}/{media.length}
          </div>
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
              onClick={() => setActiveIndex(index)}
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
    </div>
  );
}
