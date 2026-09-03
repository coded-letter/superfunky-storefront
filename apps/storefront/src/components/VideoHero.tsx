import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLayoutPreferences } from "@funky/ui";
import type { HeadingLevel } from "../lib/headingLevels";

type VideoSource =
  | { kind: "direct"; url: string }
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string };

declare global {
  interface Window {
    __funkyStorefrontMediaActivationRequested?: boolean;
  }
}

function hasMediaActivationIntent() {
  return typeof window !== "undefined"
    && (
      navigator.userActivation?.hasBeenActive
      || window.__funkyStorefrontMediaActivationRequested === true
    );
}

function resolveVideoSource(value: string): VideoSource | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (/\.(mp4|webm)(?:$|\?)/i.test(url.href)) return { kind: "direct", url: url.href };
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? { kind: "youtube", id } : null;
    }
    if (/(^|\.)youtube\.com$/.test(url.hostname)) {
      const id = url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1];
      return id ? { kind: "youtube", id } : null;
    }
    if (/(^|\.)vimeo\.com$/.test(url.hostname)) {
      const id = url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1];
      return id ? { kind: "vimeo", id } : null;
    }
  } catch {
    return null;
  }
  return null;
}

export type VideoHeroProps = {
  source: string;
  poster?: string;
  kicker?: string;
  title: string;
  headingLevel?: HeadingLevel;
  description?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  height?: string;
  overlayOpacity?: number;
  align?: "left" | "center" | "right";
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  variant?: "glow" | "fullbleed" | "split" | "minimal" | "strip";
};

export function VideoHero({
  source,
  poster,
  kicker,
  title,
  headingLevel = "h2",
  description,
  primaryCta,
  secondaryCta,
  height = "70vh",
  overlayOpacity = 55,
  align = "left",
  autoplay = true,
  loop = true,
  muted = true,
  variant = "fullbleed",
}: VideoHeroProps) {
  const { themeMaxWidthPx } = useLayoutPreferences();
  const resolved = useMemo(() => resolveVideoSource(source), [source]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Browsers block audible autoplay. Keep unmuted heroes on their poster until
  // the visitor explicitly starts playback.
  const [playing, setPlaying] = useState(() =>
    autoplay
    && muted
    && (typeof window === "undefined" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  );
  const [audioMuted, setAudioMuted] = useState(muted);
  const [activatedMediaSource, setActivatedMediaSource] = useState<string | null>(() =>
    hasMediaActivationIntent() ? source : null,
  );
  const mediaActivated = !resolved || Boolean(poster) || activatedMediaSource === source;
  const playbackActive = playing && mediaActivated;

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyReducedMotion = () => {
      if (!reducedMotion.matches) return;
      setPlaying(false);
      videoRef.current?.pause();
    };
    applyReducedMotion();
    reducedMotion.addEventListener("change", applyReducedMotion);
    return () => reducedMotion.removeEventListener("change", applyReducedMotion);
  }, []);

  useEffect(() => {
    if (!resolved || poster || activatedMediaSource === source) return;
    if (hasMediaActivationIntent()) {
      setActivatedMediaSource(source);
      return;
    }

    const events = ["pointerdown", "keydown", "touchstart", "wheel"] as const;
    const removeActivationListeners = () => {
      events.forEach((eventName) => window.removeEventListener(eventName, activateMedia));
    };
    function activateMedia(event: Event) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-video-hero-control]")) return;
      removeActivationListeners();
      setActivatedMediaSource(source);
    }
    events.forEach((eventName) => {
      window.addEventListener(eventName, activateMedia, { passive: true });
    });
    return removeActivationListeners;
  }, [activatedMediaSource, poster, resolved, source]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !mediaActivated) return;
    if (!playing) {
      video.pause();
      return;
    }
    void video.play().catch(() => setPlaying(false));
  }, [mediaActivated, playing]);

  const togglePlayback = () => {
    const next = !playbackActive;
    setActivatedMediaSource(source);
    setPlaying(next);
  };
  const startProviderPlayback = () => {
    if (!iframeRef.current || !resolved) return;
    const command = resolved.kind === "youtube"
      ? JSON.stringify({ event: "command", func: audioMuted ? "mute" : "unMute", args: [] })
      : JSON.stringify({ method: "setVolume", value: audioMuted ? 0 : 1 });
    iframeRef.current.contentWindow?.postMessage(command, "*");
    if (resolved.kind === "youtube" && !audioMuted) {
      iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
    }
  };
  const toggleMute = () => {
    const next = !audioMuted;
    setActivatedMediaSource(source);
    setAudioMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
    if (iframeRef.current && resolved) {
      const command = resolved.kind === "youtube"
        ? JSON.stringify({ event: "command", func: next ? "mute" : "unMute", args: [] })
        : JSON.stringify({ method: "setVolume", value: next ? 0 : 1 });
      iframeRef.current.contentWindow?.postMessage(command, "*");
    }
  };
  const iframeUrl = resolved?.kind === "youtube"
    ? `https://www.youtube-nocookie.com/embed/${resolved.id}?autoplay=1&mute=1&controls=0&enablejsapi=1&playsinline=1&loop=${loop ? 1 : 0}&playlist=${resolved.id}`
    : resolved?.kind === "vimeo"
      ? `https://player.vimeo.com/video/${resolved.id}?autoplay=1&muted=1&background=0&controls=0&loop=${loop ? 1 : 0}&dnt=1`
      : "";
  const alignment = align === "center" ? "items-center text-center" : align === "right" ? "items-end text-right" : "items-start text-left";
  const isSplit = variant === "split";
  const isMinimal = variant === "minimal";
  const isStrip = variant === "strip";
  const sectionClass = isSplit
    ? "grid overflow-hidden border border-zinc-200 bg-white text-zinc-950 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 dark:text-white sm:grid-cols-2"
    : isMinimal
      ? "relative flex overflow-hidden border border-zinc-200 bg-white text-zinc-950 shadow-soft dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
      : `relative flex overflow-hidden ${variant === "fullbleed" ? "shadow-soft-lg" : ""} bg-zinc-950 text-white`;
  const breakoutClass = variant === "fullbleed" ? " left-1/2 right-1/2 -mx-[50vw] w-screen" : "";
  const mediaClass = isSplit
    ? "relative min-h-[18rem] overflow-hidden sm:order-2"
    : "absolute inset-0 overflow-hidden";
  const contentClass = isSplit
    ? `flex flex-col justify-center gap-5 p-8 sm:p-12 ${alignment}`
    : `relative z-10 flex w-full flex-col ${isStrip ? "justify-center gap-2 p-6 sm:p-8" : variant === "fullbleed" ? "justify-center gap-5 p-8 sm:p-12" : "justify-end gap-5 p-8 sm:p-12"} ${alignment}`;
  const headingClass = isStrip ? "text-xl sm:text-2xl" : "text-4xl sm:text-6xl";
  const Heading = headingLevel;

  return (
    <section
      className={`${sectionClass}${breakoutClass}`}
      style={{
        minHeight: isStrip ? undefined : height,
        borderRadius: variant === "fullbleed" ? 0 : "var(--theme-radius)",
      }}
    >
      <div className={mediaClass}>
        {poster ? <img src={poster} alt="" aria-hidden="true" className={`absolute inset-0 !h-full w-full object-cover ${isMinimal ? "opacity-15" : ""}`} /> : null}
        {resolved?.kind === "direct" ? (
          <video ref={videoRef} src={mediaActivated ? resolved.url : undefined} poster={poster} preload={mediaActivated ? "auto" : "none"} autoPlay={playbackActive} muted={audioMuted} loop={loop} playsInline aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className={`absolute inset-0 !h-full w-full object-cover ${isMinimal ? "opacity-15" : ""}`} />
        ) : playbackActive && iframeUrl ? (
          <iframe ref={iframeRef} src={iframeUrl} title="Background video" tabIndex={-1} aria-hidden="true" allow="autoplay; fullscreen" onLoad={startProviderPlayback} className={`pointer-events-none absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2 border-0 ${isMinimal ? "opacity-15" : ""}`} />
        ) : null}
        {!isMinimal ? <div className="absolute inset-0 bg-black" style={{ opacity: Math.min(90, Math.max(0, overlayOpacity)) / 100 }} aria-hidden="true" /> : null}
        {variant === "glow" ? <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgb(var(--brand-gradient-from)/0.4),transparent_70%)]" aria-hidden="true" /> : null}
      </div>
      <div className={contentClass} style={variant === "fullbleed" ? { maxWidth: `${themeMaxWidthPx}px`, marginInline: "auto" } : undefined}>
        {kicker ? <span className="inline-flex rounded-full bg-white/15 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide backdrop-blur">{kicker}</span> : null}
        <Heading className={`m-0 max-w-3xl font-display font-extrabold leading-tight ${headingClass}`}>{title}</Heading>
        {description ? <p className={`m-0 max-w-2xl text-base sm:text-lg ${isSplit || isMinimal ? "text-zinc-600 dark:text-zinc-300" : "text-white/85"}`}>{description}</p> : null}
        <div className="relative z-30 flex flex-wrap gap-3">
          {primaryCta ? <Link to={primaryCta.href} className="rounded-control bg-brand-gradient px-6 py-3 text-sm font-semibold text-white no-underline">{primaryCta.label}</Link> : null}
          {secondaryCta ? <Link to={secondaryCta.href} className="rounded-control border border-white/40 px-6 py-3 text-sm font-semibold text-white no-underline backdrop-blur">{secondaryCta.label}</Link> : null}
        </div>
      </div>
      {resolved ? (
        <div className={`absolute bottom-5 z-20 ${variant === "fullbleed" ? "inset-x-0 mx-auto flex w-full justify-end gap-2 px-4 sm:px-6 lg:px-8" : "right-5 flex gap-2"}`} style={variant === "fullbleed" ? { maxWidth: `${themeMaxWidthPx}px` } : undefined}>
            <button type="button" data-video-hero-control onClick={toggleMute} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur" aria-label={audioMuted ? "Unmute background video" : "Mute background video"}>
              {audioMuted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button type="button" data-video-hero-control data-storefront-control="video-hero-play" onClick={togglePlayback} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur" aria-label={playbackActive ? "Pause background video" : "Play background video"}>
              {playbackActive ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
            </button>
        </div>
      ) : null}
    </section>
  );
}
