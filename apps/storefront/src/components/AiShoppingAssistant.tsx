import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Bot, Command, LoaderCircle, MessageCircle, Send, Sparkles, Trash2, X } from "lucide-react";
import { headerIconButtonClassName, resolveHeaderActionIcon, useIsNearPageBottom, useLanguage } from "@funky/ui";
import { restUrl } from "@funky/sdk";
import type { StorefrontConfiguration } from "../lib/navigation";
import {
  discoverNativeAssistantProvider,
  mergeAssistantConfigResponses,
  parseAssistantConfigPayload,
  parseJsonObjectPayload,
  resolveAssistantRuntime,
  resolveAssistantThemeConfig,
  validateAssistantAssetUrl,
  type AssistantConfigResponse,
  type AssistantIconPreset,
  type AssistantPlacement,
  type ResolvedAssistantRuntime,
} from "../lib/aiAssistant";
import { AssistantRobot3D, scheduleAssistantRobotPreload } from "./AssistantRobot3D";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  content?: string;
  error?: string;
  message?: string;
};

type AssistantSurfaceSlots = {
  assistantOverlaySlot: ReactNode | null;
  floatingAssistantSlot: ReactNode | null;
  footerAssistantSlot: ReactNode | null;
  headerActionSlot: ReactNode | null;
  placement: AssistantPlacement;
};

const HISTORY_KEY = "funkycommerce-ai-shopping-history";
const CLIENT_KEY = "funkycommerce-ai-shopping-client";
const canonicalConfigEndpoint = restUrl("funkycommerce-ai-assistant/v1/config");
const legacyConfigEndpoint = restUrl("ao-agentic/v1/config");
const canonicalChatEndpoint = restUrl("funkycommerce-ai-assistant/v1/chat");
const legacyChatEndpoint = restUrl("ao-agentic/v1/chat");

export function useAiShoppingAssistantSurfaces(
  storefrontConfig?: StorefrontConfiguration | null,
): AssistantSurfaceSlots {
  const { languageCode } = useLanguage();
  const themeConfig = useMemo(
    () => resolveAssistantThemeConfig(storefrontConfig?.aiAssistant),
    [storefrontConfig?.aiAssistant],
  );
  const [runtime, setRuntime] = useState<ResolvedAssistantRuntime>(() =>
    resolveAssistantRuntime({
      nativeDiscovery: { status: "unavailable" },
      themeConfig,
    }),
  );
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(readHistory);
  const [clientId] = useState(readClientId);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [chatEndpoint, setChatEndpoint] = useState(canonicalChatEndpoint);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const dialogId = useId();
  const isNearPageBottom = useIsNearPageBottom();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const controller = new AbortController();
    let cancelled = false;
    setRuntimeReady(false);

    const loadAssistantRuntime = async () => {
      const nativeDiscovery = discoverNativeAssistantProvider(window as unknown as Record<string, unknown>);
      const providerConfigPromise = nativeDiscovery.status === "ready" && nativeDiscovery.provider.getConfig
        ? Promise.resolve(nativeDiscovery.provider.getConfig()).catch(() => null)
        : Promise.resolve<AssistantConfigResponse | null>(null);
      const endpointConfigPromise = (async (): Promise<AssistantConfigResponse | null> => {
        for (const [endpoint, matchingChatEndpoint] of [
          [canonicalConfigEndpoint, canonicalChatEndpoint],
          [legacyConfigEndpoint, legacyChatEndpoint],
        ] as const) {
          if (!endpoint) continue;
          try {
            const response = await fetch(endpoint, { signal: controller.signal });
            if (response.ok) {
              const config = parseAssistantConfigPayload(await response.text());
              if (config && !cancelled) setChatEndpoint(matchingChatEndpoint);
              if (config) return config;
              console.warn(`AI Assistant config from ${endpoint} was not valid JSON.`);
              continue;
            }
            if (response.status !== 404) {
              if (!cancelled) setChatEndpoint(matchingChatEndpoint);
              return { has_api_key: false };
            }
          } catch (requestError) {
            if (controller.signal.aborted) return null;
            console.warn(`AI Assistant config request to ${endpoint} failed.`, requestError);
          }
        }
        return null;
      })();

      const [providerConfig, endpointConfig] = await Promise.all([providerConfigPromise, endpointConfigPromise]);
      if (cancelled) return;
      setRuntime(
        resolveAssistantRuntime({
          currentOrigin: window.location.origin,
          fetchedConfig: mergeAssistantConfigResponses(providerConfig, endpointConfig),
          nativeDiscovery,
          themeConfig,
        }),
      );
      setRuntimeReady(true);
    };

    void loadAssistantRuntime();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [themeConfig]);

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  useEffect(() => {
    if (runtime.launcher.kind !== "3d") return;
    return scheduleAssistantRobotPreload(runtime.launcher.textureUrl);
  }, [runtime.launcher]);

  const title = runtime.theme.title;
  const subtitle = runtime.theme.subtitle;
  const assistantIconName = storefrontConfig?.headerIcons?.assistant;
  const assistantHeaderIconUrl = typeof window === "undefined"
    ? null
    : validateAssistantAssetUrl(storefrontConfig?.headerIconMedia?.assistant, window.location.origin);

  const openAssistant = () => {
    setError(null);
    if (runtime.kind === "native") {
      const action = runtime.provider.open || runtime.provider.toggle;
      if (!action) {
        setError("The native assistant is not available right now.");
        return;
      }
      Promise.resolve(action()).catch(() => setError("The native assistant could not be opened."));
      return;
    }
    setOpen(true);
  };

  const closeAssistant = useCallback(() => {
    if (runtime.kind === "native") {
      Promise.resolve(runtime.provider.close?.()).catch(() => undefined);
      return;
    }
    setOpen(false);
  }, [runtime]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || !chatEndpoint || sending || runtime.kind !== "rest" || !runtime.configured) return;

    const userMessage: ChatMessage = { role: "user", content: message };
    const nextMessages = [...messages, userMessage].slice(-10);
    setMessages(nextMessages);
    storeHistory(nextMessages);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const response = await fetch(chatEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          language: languageCode,
          client_id: clientId,
          history: messages.slice(-9).map(({ role, content }) => ({ role, content })),
        }),
      });
      const result = parseJsonObjectPayload(await response.text()) as ChatResponse | null;
      if (!response.ok) {
        throw new Error(result?.error || result?.message || `Assistant request failed (${response.status}).`);
      }
      if (!result?.content) throw new Error("Assistant response did not include content.");

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: responseToText(result.content),
      };
      const completed = [...nextMessages, assistantMessage].slice(-10);
      setMessages(completed);
      storeHistory(completed);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant is temporarily unavailable.");
    } finally {
      setSending(false);
    }
  };

  const clear = () => {
    setMessages([]);
    setError(null);
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch {
      // The visible conversation is still cleared.
    }
  };

  const footerAssistantSlot = !runtimeReady || runtime.kind === "hidden" || runtime.theme.placement !== "footer"
    ? null
    : (
        <AssistantSurfaceCard
          mode="footer"
          onClear={runtime.kind === "rest" ? clear : undefined}
          onClose={undefined}
          onOpen={openAssistant}
          runtime={runtime}
          title={title}
          subtitle={subtitle}
          composerValue={input}
          onComposerChange={setInput}
          onSubmit={submit}
          messages={messages}
          error={error}
          sending={sending}
          messageEndRef={messageEndRef}
          iconName={assistantIconName}
        />
      );

  const floatingAssistantSlot = !runtimeReady || runtime.kind === "hidden" || runtime.theme.placement !== "fixed"
    ? null
    : (
        <aside className="sf-ai-assistant-launcher fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3">
          {runtime.kind === "native"
            ? null
            : open ? (
                <AssistantSurfaceCard
                  mode="fixed"
                  onClear={runtime.kind === "rest" ? clear : undefined}
                  onClose={closeAssistant}
                  onOpen={openAssistant}
                  runtime={runtime}
                  title={title}
                  subtitle={subtitle}
                  composerValue={input}
                  onComposerChange={setInput}
                  onSubmit={submit}
                  messages={messages}
                  error={error}
                  sending={sending}
                  messageEndRef={messageEndRef}
                  iconName={assistantIconName}
                />
              ) : null}
          <AssistantLauncherButton
            appearance={runtime.launcher}
            expanded={runtime.kind !== "native" ? open : undefined}
            iconName={assistantIconName}
            label={runtime.launcher.label}
            onClick={() => (runtime.kind === "native" ? openAssistant() : setOpen((current) => !current))}
            hidden={isNearPageBottom || (runtime.kind !== "native" && open)}
          />
        </aside>
      );

  const assistantOverlaySlot = !runtimeReady || runtime.kind === "hidden" || runtime.theme.placement !== "header-command-overlay"
    ? null
    : (
        <AssistantDialog
          description={subtitle}
          dialogId={dialogId}
          isOpen={open && runtime.kind !== "native"}
          onClose={closeAssistant}
          title={title}
        >
          <AssistantSurfaceCard
            mode="overlay"
            onClear={runtime.kind === "rest" ? clear : undefined}
            onClose={closeAssistant}
            onOpen={openAssistant}
            runtime={runtime}
            title={title}
            subtitle={subtitle}
            composerValue={input}
            onComposerChange={setInput}
            onSubmit={submit}
            messages={messages}
            error={error}
            sending={sending}
            messageEndRef={messageEndRef}
            iconName={assistantIconName}
            minimalChrome
          />
        </AssistantDialog>
      );

  const headerActionSlot = !runtimeReady || runtime.kind === "hidden" || runtime.theme.placement !== "header-command-overlay"
    ? null
    : (
        <button
          type="button"
          onClick={openAssistant}
          aria-controls={dialogId}
          aria-expanded={runtime.kind === "native" ? undefined : open}
          aria-haspopup="dialog"
          aria-label={runtime.launcher.label}
          title={runtime.kind === "native" ? "Open native AI Assistant" : title}
          className={headerIconButtonClassName}
        >
          <AssistantLauncherVisual
            allow3d={false}
            appearance={runtime.launcher}
            customIconUrl={assistantHeaderIconUrl}
            iconName={assistantIconName}
            size="header-action"
          />
        </button>
      );

  return {
    assistantOverlaySlot,
    floatingAssistantSlot,
    footerAssistantSlot,
    headerActionSlot,
    placement: runtime.theme.placement,
  };
}

function AssistantSurfaceCard({
  mode,
  onClear,
  onClose,
  onOpen,
  runtime,
  title,
  subtitle,
  composerValue,
  onComposerChange,
  onSubmit,
  messages,
  error,
  sending,
  messageEndRef,
  iconName,
  minimalChrome = false,
}: {
  mode: "fixed" | "footer" | "overlay";
  onClear?: () => void;
  onClose?: () => void;
  onOpen: () => void;
  runtime: Exclude<ResolvedAssistantRuntime, { kind: "hidden" }>;
  title: string;
  subtitle: string;
  composerValue: string;
  onComposerChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  messages: ChatMessage[];
  error: string | null;
  sending: boolean;
  messageEndRef: RefObject<HTMLDivElement>;
  iconName?: string;
  minimalChrome?: boolean;
}) {
  if (runtime.kind === "native") {
    return (
      <NativeAssistantCard
        appearance={runtime.launcher}
        iconName={iconName}
        onOpen={onOpen}
        subtitle={subtitle}
        title={title}
      />
    );
  }

  if (runtime.kind === "rest" && !runtime.configured) {
    return (
      <section className={surfaceShellClass(mode, minimalChrome)}>
        <AssistantCardHeader appearance={runtime.launcher} iconName={iconName} onClose={onClose} subtitle={subtitle} title={title} />
        <div className="grid min-h-[16rem] place-items-center p-6 text-center">
          <div>
            <Bot className="mx-auto mb-3 h-8 w-8 text-zinc-500" aria-hidden="true" />
            <p className="font-medium text-zinc-950 dark:text-white">AI Assistant needs configuration</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Add a valid API key in the WordPress AI Assistant settings.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (runtime.kind === "iframe") {
    return (
      <section className={surfaceShellClass(mode, minimalChrome)}>
        <AssistantCardHeader appearance={runtime.launcher} iconName={iconName} onClose={onClose} subtitle={subtitle} title={title} />
        <div className={`min-h-[22rem] ${mode === "footer" ? "lg:min-h-[24rem]" : ""}`}>
          <iframe
            src={runtime.iframe.src}
            title={runtime.theme.iframeTitle}
            className="h-full min-h-[22rem] w-full border-0 bg-transparent"
            loading="lazy"
            referrerPolicy={runtime.theme.iframeReferrerPolicy}
            sandbox={runtime.theme.iframeSandbox}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={surfaceShellClass(mode, minimalChrome)}>
      <AssistantCardHeader appearance={runtime.launcher} iconName={iconName} onClear={onClear} onClose={onClose} subtitle={subtitle} title={title} />
      <div className={`flex-1 space-y-3 overflow-y-auto p-4 ${mode === "footer" ? "min-h-[20rem]" : ""}`} aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {runtime.theme.greeting}
          </p>
        ) : null}
        {messages.map((message, index) => (
          <p
            key={`${message.role}-${index}`}
            className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                : "bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            }`}
          >
            {message.content}
          </p>
        ))}
        {sending ? <LoaderCircle className="animate-spin text-zinc-500" size={18} aria-label="Assistant is responding" /> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div ref={messageEndRef} />
      </div>
      <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
        <label className="sr-only" htmlFor={`ai-shopping-message-${mode}`}>Ask about products</label>
        <input
          id={`ai-shopping-message-${mode}`}
          value={composerValue}
          onChange={(event) => onComposerChange(event.target.value)}
          maxLength={1000}
          placeholder={runtime.theme.composerPlaceholder}
          data-assistant-composer
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-700 dark:border-zinc-700"
        />
        <button type="submit" disabled={!composerValue.trim() || sending} className="rounded-xl bg-zinc-950 p-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950" aria-label="Send message">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

function AssistantCardHeader({
  appearance,
  iconName,
  title,
  subtitle,
  onClear,
  onClose,
}: {
  appearance: Exclude<ResolvedAssistantRuntime, { kind: "hidden" }>["launcher"];
  iconName?: string;
  title: string;
  subtitle: string;
  onClear?: () => void;
  onClose?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-grid h-11 w-11 shrink-0 place-items-center overflow-hidden text-brand-600 dark:text-brand-300">
          <AssistantLauncherVisual appearance={appearance} iconName={iconName} priority size="chat-header" />
        </span>
        <div className="min-w-0">
          <strong className="block truncate text-sm text-zinc-950 dark:text-white">{title}</strong>
          <span className="block truncate text-xs text-zinc-500">{subtitle}</span>
        </div>
      </div>
      <div className="flex gap-1">
        {onClear ? (
          <button type="button" onClick={onClear} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Clear conversation">
            <Trash2 size={16} />
          </button>
        ) : null}
        {onClose ? (
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close assistant">
            <X size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function AssistantLauncherButton({
  appearance,
  expanded,
  hidden,
  iconName,
  label,
  onClick,
}: {
  appearance: Exclude<ResolvedAssistantRuntime, { kind: "hidden" }>["launcher"];
  expanded?: boolean;
  hidden: boolean;
  iconName?: string;
  label: string;
  onClick: () => void;
}) {
  const [visualReady, setVisualReady] = useState(appearance.kind !== "3d");
  useEffect(() => setVisualReady(appearance.kind !== "3d"), [appearance]);
  const visuallyHidden = hidden || !visualReady;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-gradient text-white shadow-glow transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-soft-lg ${
        visuallyHidden ? "pointer-events-none translate-y-4 scale-90 opacity-0" : "pointer-events-auto translate-y-0 scale-100 opacity-100"
      }`}
      aria-label={label}
      aria-expanded={expanded}
      aria-hidden={visuallyHidden}
      tabIndex={visuallyHidden ? -1 : 0}
    >
      <AssistantLauncherVisual
        appearance={appearance}
        iconName={iconName}
        on3dStatusChange={(status) => setVisualReady(status !== "loading")}
        size="launcher"
      />
    </button>
  );
}

function AssistantLauncherVisual({
  allow3d = true,
  appearance,
  customIconUrl,
  iconName,
  on3dStatusChange,
  priority = false,
  size = "launcher",
}: {
  allow3d?: boolean;
  appearance: Exclude<ResolvedAssistantRuntime, { kind: "hidden" }>["launcher"];
  customIconUrl?: string | null;
  iconName?: string;
  on3dStatusChange?: (status: "failed" | "loading" | "ready") => void;
  priority?: boolean;
  size?: "chat-header" | "header-action" | "launcher";
}) {
  const imageUrl = customIconUrl || (appearance.kind === "custom" ? appearance.customIconUrl : null);
  if (imageUrl) return <AssistantIconImage fallbackPreset={appearance.iconPreset} iconName={iconName} size={size} src={imageUrl} />;
  if (appearance.kind === "3d" && allow3d) {
    const Fallback = resolveLauncherIcon(appearance.iconPreset, iconName);
    return (
      <AssistantRobot3D
        environmentUrl={appearance.environmentUrl}
        fallback={<Fallback className="h-5 w-5" aria-hidden="true" />}
        modelSize={size === "chat-header" ? 3 : 3.35}
        onStatusChange={on3dStatusChange}
        priority={priority || size === "launcher"}
        showFallbackWhileLoading={size !== "launcher"}
        textureUrl={appearance.textureUrl}
      />
    );
  }
  const Icon = resolveLauncherIcon(appearance.iconPreset, iconName);
  const iconClassName = size === "header-action" ? "h-[1.15rem] w-[1.15rem]" : "h-5 w-5";
  return <Icon className={iconClassName} aria-hidden="true" />;
}

function AssistantIconImage({
  fallbackPreset,
  iconName,
  size,
  src,
}: {
  fallbackPreset: AssistantIconPreset;
  iconName?: string;
  size: "chat-header" | "header-action" | "launcher";
  src: string;
}) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(() => loadedAssistantIconUrls.has(src));
  useEffect(() => {
    setFailed(false);
    setReady(loadedAssistantIconUrls.has(src));
  }, [src]);
  const Fallback = resolveLauncherIcon(fallbackPreset, iconName);
  const fallbackClassName = size === "header-action" ? "h-[1.15rem] w-[1.15rem]" : "h-5 w-5";
  const pixels = size === "header-action" ? 18 : size === "chat-header" ? 36 : 28;
  return (
    <span className="relative inline-grid h-full w-full place-items-center">
      <Fallback
        className={`${fallbackClassName} transition-opacity duration-150 ${ready && !failed ? "opacity-0" : "opacity-100"}`}
        aria-hidden="true"
      />
      {!failed ? (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority={size === "header-action" ? "high" : "auto"}
          height={pixels}
          width={pixels}
          className={`absolute ${size === "header-action" ? "h-[1.15rem] w-[1.15rem]" : size === "chat-header" ? "h-9 w-9" : "h-7 w-7"} rounded-full object-cover transition-opacity duration-150 ${ready ? "opacity-100" : "opacity-0"}`}
          onLoad={() => {
            loadedAssistantIconUrls.add(src);
            setReady(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}

const loadedAssistantIconUrls = new Set<string>();

function NativeAssistantCard({
  title,
  subtitle,
  onOpen,
  appearance,
  iconName,
}: {
  title: string;
  subtitle: string;
  onOpen: () => void;
  appearance: Exclude<ResolvedAssistantRuntime, { kind: "hidden" }>["launcher"];
  iconName?: string;
}) {
  return (
    <section className="grid gap-4 rounded-2xl border border-zinc-700/70 bg-zinc-900/60 p-5 text-left">
      <div className="flex items-center gap-3">
        <span className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
          <AssistantLauncherVisual appearance={appearance} iconName={iconName} />
        </span>
        <div className="grid gap-0.5">
          <strong className="text-sm text-zinc-100">{title}</strong>
          <span className="text-xs text-zinc-400">{subtitle}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5"
      >
        <Command className="h-4 w-4" aria-hidden="true" />
        Open native assistant
      </button>
    </section>
  );
}

function AssistantDialog({
  children,
  description,
  dialogId,
  isOpen,
  onClose,
  title,
}: {
  children: ReactNode;
  description?: string;
  dialogId: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hasOpened, setHasOpened] = useState(isOpen);
  const headingId = `${dialogId}-heading`;
  const descriptionId = `${dialogId}-description`;

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || typeof window === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const focusSelector = "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusTarget = panelRef.current?.querySelector<HTMLElement>("[data-assistant-composer]")
      || panelRef.current?.querySelector<HTMLElement>(focusSelector);
    (focusTarget || panelRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(focusSelector)];
      if (!focusable.length) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }
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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if ((!isOpen && !hasOpened) || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden={!isOpen}
      className={isOpen
        ? "fixed inset-0 z-[80] flex h-[100dvh] w-screen items-center justify-center p-4 sm:p-6"
        : "hidden"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
        aria-label="Close assistant overlay"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="relative z-[81] w-full max-w-2xl outline-none"
      >
        {description ? <p id={descriptionId} className="sr-only">{description}</p> : null}
        <h2 id={headingId} className="sr-only">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function surfaceShellClass(mode: "fixed" | "footer" | "overlay", minimalChrome: boolean) {
  const width = mode === "footer"
    ? "w-full"
    : mode === "overlay"
      ? "w-full max-w-2xl"
      : "w-[min(24rem,calc(100vw-1rem))]";
  const height = mode === "footer" ? "min-h-[22rem]" : "h-[min(36rem,calc(100vh-7rem))]";
  return [
    "sf-ai-assistant flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950",
    width,
    mode === "footer" ? "" : height,
    minimalChrome ? "border-transparent shadow-none" : "",
  ].join(" ").trim();
}

function readClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(CLIENT_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return existing;
    const generated = window.crypto.randomUUID();
    window.localStorage.setItem(CLIENT_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

function readHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (message): message is ChatMessage =>
        typeof message === "object"
        && message !== null
        && ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant")
        && typeof (message as ChatMessage).content === "string",
    ).slice(-10);
  } catch {
    return [];
  }
}

function storeHistory(messages: ChatMessage[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-10)));
  } catch {
    // Conversation remains available until this page is closed.
  }
}

function responseToText(content: string): string {
  if (typeof DOMParser === "undefined") return content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const document = new DOMParser().parseFromString(content, "text/html");
  return (document.body.textContent || "").replace(/\s+/g, " ").trim();
}

function resolveLauncherIcon(iconPreset: AssistantIconPreset, iconName?: string) {
  const fallback = iconPreset === "bot" ? Bot : iconPreset === "sparkles" ? Sparkles : MessageCircle;
  return resolveHeaderActionIcon(iconName, fallback);
}
