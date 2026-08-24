import { BACKEND_ORIGIN } from "@funky/sdk";
import { Bot, MessageCircle, Send, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { chatAssistantEndpoints, resolveFlatAssistantIcon, type FlatAssistantIcon } from "../lib/chatAssistant";

type Message = { role: "user" | "assistant"; content: string };
type AssistantConfig = {
  has_api_key?: boolean;
  title?: string;
  greeting?: string;
  composer_placeholder?: string;
  appearance?: {
    custom_icon_url?: string;
    icon_preset?: string;
    launcher_label?: string;
  };
};

function ConfiguredIcon({ config }: { config: AssistantConfig | null }) {
  const customIcon = config?.appearance?.custom_icon_url;
  const [imageFailed, setImageFailed] = useState(false);
  if (customIcon && !imageFailed) {
    return <img src={customIcon} alt="" className="h-5 w-5 rounded-full object-cover" onError={() => setImageFailed(true)} />;
  }

  const icons: Record<FlatAssistantIcon, typeof MessageCircle> = {
    "message-circle": MessageCircle,
    bot: Bot,
    sparkles: Sparkles,
  };
  const Icon = icons[resolveFlatAssistantIcon(config?.appearance?.icon_preset)];
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

export function ChatAssistantShortcode() {
  const endpoints = useMemo(() => chatAssistantEndpoints(BACKEND_ORIGIN), []);
  const clientId = useMemo(() => crypto.randomUUID(), []);
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoints.config, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Assistant configuration is unavailable.")))
      .then(setConfig)
      .catch((reason) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [endpoints]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    const history = [...messages, { role: "user" as const, content: message }].slice(-10);
    setMessages(history);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoints.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          client_id: clientId,
          history: messages.slice(-9),
          language: (document.documentElement.lang || navigator.language || "en").slice(0, 2),
        }),
      });
      const payload = await response.json() as { content?: string; error?: string; message?: string };
      if (!response.ok || !payload.content) throw new Error(payload.error || payload.message || "The assistant could not reply.");
      setMessages((current) => [...current, { role: "assistant", content: payload.content! }].slice(-10));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The assistant could not reply.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto flex h-[min(32rem,70vh)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-950" aria-label="AI Assistant">
      <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white"><ConfiguredIcon config={config} /></span>
        <strong>{config?.title || "AI Assistant"}</strong>
      </header>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 ? <p className="m-0 rounded-2xl bg-zinc-100 p-3 text-sm dark:bg-zinc-900">{config?.greeting || "Ask about products or site content."}</p> : null}
        {messages.map((message, index) => (
          <p key={`${message.role}-${index}`} className={`m-0 max-w-[88%] rounded-2xl p-3 text-sm ${message.role === "user" ? "self-end bg-brand-500 text-white" : "bg-zinc-100 dark:bg-zinc-900"}`}>{message.content}</p>
        ))}
        {error ? <p role="alert" className="m-0 text-sm text-red-600">{error}</p> : null}
      </div>
      <form className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800" onSubmit={submit}>
        <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} disabled={busy || config?.has_api_key === false} aria-label="Ask the AI Assistant" placeholder={config?.composer_placeholder || "Ask the AI Assistant…"} className="min-w-0 flex-1 rounded-full border border-zinc-200 bg-transparent px-4 py-2 text-sm dark:border-zinc-700" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Send message" className="grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-white disabled:opacity-50"><Send className="h-4 w-4" aria-hidden="true" /></button>
      </form>
    </section>
  );
}
