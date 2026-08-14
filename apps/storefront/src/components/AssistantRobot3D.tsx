import { useEffect, useRef, useState, type ReactNode } from "react";

type AssistantRobot3DProps = {
  environmentUrl?: string | null;
  fallback?: ReactNode;
  modelSize?: number;
  onStatusChange?: (status: "failed" | "loading" | "ready") => void;
  priority?: boolean;
  showFallbackWhileLoading?: boolean;
  textureUrl?: string | null;
};

const MODEL_ROOT = "/assistant-model";
const MODEL_URLS = [
  `${MODEL_ROOT}/Head.glb`,
  `${MODEL_ROOT}/Eyes.glb`,
  `${MODEL_ROOT}/Glass.glb`,
] as const;
const assetPreloads = new Map<string, Promise<void>>();
let rendererModulePromise: ReturnType<typeof loadRendererModule> | null = null;

function loadRendererModule() {
  return import("../lib/assistantRobotRenderer");
}

function getRendererModule() {
  rendererModulePromise ||= loadRendererModule().catch((error: unknown) => {
    rendererModulePromise = null;
    throw error;
  });
  return rendererModulePromise;
}

function preloadAsset(url: string) {
  const existing = assetPreloads.get(url);
  if (existing) return existing;
  const preload = fetch(url, { cache: "force-cache", credentials: "omit" })
    .then((response) => {
      if (!response.ok) throw new Error(`Asset preload failed (${response.status}).`);
      return response.arrayBuffer();
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      assetPreloads.delete(url);
      console.warn(`AI Assistant asset preload failed for ${url}.`, error);
    });
  assetPreloads.set(url, preload);
  return preload;
}

export function scheduleAssistantRobotPreload(textureUrl?: string | null) {
  if (typeof window === "undefined") return () => undefined;
  let cancelled = false;
  let idleHandle: number | undefined;
  let timeoutHandle: number | undefined;
  const preload = () => {
    if (cancelled) return;
    void getRendererModule().catch((error: unknown) => {
      console.warn("AI Assistant renderer preload failed.", error);
    });
    MODEL_URLS.forEach((url) => void preloadAsset(url));
    if (textureUrl) void preloadAsset(textureUrl);
  };
  if ("requestIdleCallback" in window) {
    idleHandle = window.requestIdleCallback(preload, { timeout: 1000 });
  } else {
    timeoutHandle = window.setTimeout(preload, 200);
  }
  return () => {
    cancelled = true;
    if (idleHandle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
    if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
  };
}

export function AssistantRobot3D({
  environmentUrl,
  fallback,
  modelSize = 3.2,
  onStatusChange,
  priority = false,
  showFallbackWhileLoading = true,
  textureUrl,
}: AssistantRobot3DProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (priority) {
      setShouldLoad(true);
      return;
    }
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;
    const requestLoad = () => {
      if ("requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(() => setShouldLoad(true), { timeout: 1200 });
      } else {
        timeoutHandle = window.setTimeout(() => setShouldLoad(true), 250);
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      requestLoad();
    }, { threshold: 0.1 });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (idleHandle !== undefined && "cancelIdleCallback" in window) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [priority]);

  useEffect(() => {
    if (!shouldLoad) return;
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    const controller = new AbortController();
    let cleanup = () => undefined;
    setFailed(false);
    setReady(false);
    onStatusChange?.("loading");

    void getRendererModule().then(({ mountAssistantRobot }) => {
      if (controller.signal.aborted) return;
      cleanup = mountAssistantRobot(canvas, {
        environmentUrl: environmentUrl || `${MODEL_ROOT}/hdr1.hdr`,
        eyesUrl: `${MODEL_ROOT}/Eyes.glb`,
        glassUrl: `${MODEL_ROOT}/Glass.glb`,
        headUrl: `${MODEL_ROOT}/Head.glb`,
        modelSize,
        onError: () => {
          setFailed(true);
          onStatusChange?.("failed");
        },
        onReady: () => {
          setReady(true);
          onStatusChange?.("ready");
        },
        signal: controller.signal,
        textureUrl,
      });
    }).catch(() => {
      setFailed(true);
      onStatusChange?.("failed");
    });

    return () => {
      controller.abort();
      cleanup();
    };
  }, [environmentUrl, modelSize, shouldLoad, textureUrl]);

  return (
    <span
      ref={containerRef}
      className="sf-assistant-robot relative block h-full w-full overflow-hidden rounded-full"
      aria-hidden="true"
      onPointerEnter={() => setShouldLoad(true)}
    >
      <span
        className={`absolute inset-0 grid place-items-center transition-opacity duration-200 ${
          (ready && !failed) || (!failed && !showFallbackWhileLoading) ? "opacity-0" : "opacity-100"
        }`}
      >
        {fallback}
      </span>
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${ready && !failed ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}
