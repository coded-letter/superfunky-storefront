import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type SoundAction = "click" | "hover" | "focus" | "success" | "error" | "navigation" | "modal-open" | "add-to-cart" | "type";

export type SoundDescriptor = {
  type: OscillatorType;
  frequency: number;
  duration: number;
  gain?: number;
  detune?: number;
};

export type SoundUXBackendConfig = {
  enabled?: boolean;
  volume?: number;
  mappings?: Partial<Record<SoundAction, SoundDescriptor>>;
};

export type SoundUXContextValue = {
  isEnabled: boolean;
  toggleEnabled: () => void;
  setBackendEnabled: (enabled: boolean) => void;
  playAction: (action: SoundAction) => void;
};

const STORAGE_KEY = "funkycommerce-mockup-sounds";

const DEFAULT_SOUND_CONFIG: Record<SoundAction, SoundDescriptor> = {
  click: { type: "triangle", frequency: 560, duration: 0.06, gain: 0.032 },
  hover: { type: "sine", frequency: 780, duration: 0.05, gain: 0.016 },
  focus: { type: "square", frequency: 900, duration: 0.05, gain: 0.02 },
  success: { type: "sine", frequency: 660, duration: 0.1, gain: 0.028, detune: 5 },
  error: { type: "sawtooth", frequency: 300, duration: 0.12, gain: 0.024 },
  navigation: { type: "sine", frequency: 700, duration: 0.08, gain: 0.025 },
  "modal-open": { type: "triangle", frequency: 520, duration: 0.08, gain: 0.024 },
  "add-to-cart": { type: "triangle", frequency: 640, duration: 0.09, gain: 0.03, detune: 3 },
  type: { type: "sine", frequency: 1180, duration: 0.02, gain: 0.012 },
};

const SoundUXContext = createContext<SoundUXContextValue | undefined>(undefined);

function readStoredEnabled(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "disabled") return false;
    if (stored === "enabled") return true;
  } catch {
    // Ignore storage access issues and use the default experience.
  }

  return true;
}

const TYPING_SKIP_INPUT_TYPES = new Set(["checkbox", "radio", "range", "file", "submit", "button", "color", "reset", "image"]);

function resolveActionFromTarget(target: EventTarget | null): SoundAction | null {
  if (!(target instanceof Element)) return null;

  const interactiveTarget = target.closest("a[href], button, [role='button'], input, select, textarea");
  if (!interactiveTarget) return null;

  if (interactiveTarget.matches("a[href]")) return "navigation";
  if (interactiveTarget.matches("button, [role='button']")) return "click";
  return "click";
}

function createAudioContext() {
  const AudioCtx = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
}

export function SoundUXProvider({
  children,
  backendConfig,
}: {
  children: ReactNode;
  backendConfig?: SoundUXBackendConfig;
}) {
  const [isEnabled, setIsEnabled] = useState(readStoredEnabled);
  const [backendEnabled, setBackendEnabled] = useState(backendConfig?.enabled ?? true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const userActivatedRef = useRef(false);

  const soundConfig = useMemo(() => {
    const merged = {
      enabled: backendEnabled,
      volume: backendConfig?.volume ?? 0.65,
      mappings: {
        ...DEFAULT_SOUND_CONFIG,
        ...backendConfig?.mappings,
      },
    } satisfies SoundUXBackendConfig & {
      enabled: boolean;
      volume: number;
      mappings: Record<SoundAction, SoundDescriptor>;
    };

    return merged;
  }, [backendConfig?.mappings, backendConfig?.volume, backendEnabled]);

  const playAction = useCallback(
    (action: SoundAction) => {
      if (!soundConfig.enabled || !isEnabled) return;

      const descriptor = soundConfig.mappings[action];
      if (!descriptor) return;

      const currentContext = audioContextRef.current?.state === "closed" ? null : audioContextRef.current;
      if (!currentContext && !userActivatedRef.current) return;
      const context = currentContext ?? createAudioContext();
      if (!context) return;

      audioContextRef.current = context;

      const play = () => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = descriptor.type;
        oscillator.frequency.setValueAtTime(descriptor.frequency, context.currentTime);
        if (descriptor.detune) {
          oscillator.detune.setValueAtTime(descriptor.detune, context.currentTime);
        }

        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime((descriptor.gain ?? 0.03) * soundConfig.volume, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + Math.max(descriptor.duration, 0.05));

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + descriptor.duration + 0.04);
      };
      if (context.state === "suspended") {
        void context.resume().then(play).catch((error: unknown) => {
          console.warn("[Sound UX] Audio playback could not be started.", error);
        });
        return;
      }
      play();
    },
    [isEnabled, soundConfig.enabled, soundConfig.mappings, soundConfig.volume],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(STORAGE_KEY, isEnabled ? "enabled" : "disabled");
    } catch {
      // Ignore storage access failures in this mock-only environment.
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!soundConfig.enabled || !isEnabled) return;

    const markUserActivated = () => {
      userActivatedRef.current = true;
    };
    const handleClick = (event: MouseEvent) => {
      const action = resolveActionFromTarget(event.target);
      if (action) {
        playAction(action);
      }
    };

    const handleHover = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a[href], button, [role='button'], input, select, textarea")) {
        playAction("hover");
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const focusTarget = event.target;
      const interactiveTarget = resolveActionFromTarget(focusTarget);
      if (interactiveTarget) {
        playAction("focus");
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        const target = event.target;
        if (target instanceof Element && target.closest("button, a[href], [role='button']")) {
          playAction("click");
        }
      }
    };

    // A soft keystroke sound for free-text entry (email, search, comment fields, ...) —
    // skips non-typing input types (checkboxes, radios, color pickers, etc.).
    const handleInput = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement) {
        playAction("type");
        return;
      }
      if (target instanceof HTMLInputElement && !TYPING_SKIP_INPUT_TYPES.has(target.type)) {
        playAction("type");
      }
    };

    document.addEventListener("pointerdown", markUserActivated, true);
    document.addEventListener("touchstart", markUserActivated, true);
    document.addEventListener("keydown", markUserActivated, true);
    document.addEventListener("click", markUserActivated, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("mouseover", handleHover, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("input", handleInput, true);

    return () => {
      document.removeEventListener("pointerdown", markUserActivated, true);
      document.removeEventListener("touchstart", markUserActivated, true);
      document.removeEventListener("keydown", markUserActivated, true);
      document.removeEventListener("click", markUserActivated, true);
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("mouseover", handleHover, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("input", handleInput, true);
    };
  }, [isEnabled, soundConfig.enabled, playAction]);

  useEffect(() => {
    return () => {
      const context = audioContextRef.current;
      audioContextRef.current = null;
      void context?.close();
    };
  }, []);

  const value = useMemo<SoundUXContextValue>(
    () => ({
      isEnabled,
      toggleEnabled: () => setIsEnabled((previous) => !previous),
      setBackendEnabled,
      playAction,
    }),
    [isEnabled, playAction]
  );

  return <SoundUXContext.Provider value={value}>{children}</SoundUXContext.Provider>;
}

export function useSoundUX(): SoundUXContextValue {
  const context = useContext(SoundUXContext);
  if (!context) {
    throw new Error("useSoundUX must be used within a SoundUXProvider");
  }
  return context;
}
