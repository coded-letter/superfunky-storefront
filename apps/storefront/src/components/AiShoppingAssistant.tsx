import { useEffect, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, MessageCircle, Send, Trash2, X } from "lucide-react";
import { useLanguage } from "@funky/ui";
import { restUrl } from "../lib/env";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  content?: string;
  error?: string;
  message?: string;
};

type AssistantConfig = {
  has_api_key?: boolean;
};

const HISTORY_KEY = "funkycommerce-ai-shopping-history";
const configEndpoint = restUrl("ao-agentic/v1/config");
const chatEndpoint = restUrl("ao-agentic/v1/chat");

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

export function AiShoppingAssistant() {
  const { languageCode } = useLanguage();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(readHistory);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!configEndpoint || !chatEndpoint) return;
    const controller = new AbortController();
    void fetch(configEndpoint, { signal: controller.signal })
      .then(async (response) => {
        if (response.ok) {
          const config = (await response.json().catch(() => null)) as AssistantConfig | null;
          setAvailable(config?.has_api_key === true);
          return;
        }
        if (response.status !== 404) {
          console.warn(`[ai-shopping-assistant] Configuration request failed (${response.status}).`);
        }
      })
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        console.warn("[ai-shopping-assistant] Configuration request failed.", requestError);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, sending]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();
    if (!message || !chatEndpoint || sending) return;

    const userMessage: ChatMessage = { role: "user", content: message };
    const nextMessages = [...messages, userMessage].slice(-10);
    setMessages(nextMessages);
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
          history: messages.slice(-9).map(({ role, content }) => ({ role, content })),
        }),
      });
      const result = (await response.json().catch(() => null)) as ChatResponse | null;
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

  if (!available) return null;

  return (
    <aside className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3">
      {open ? (
        <section
          aria-label="AI shopping assistant"
          className="flex h-[min(36rem,calc(100vh-7rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <strong className="block text-sm text-zinc-950 dark:text-white">AI Shopping Assistant</strong>
              <span className="text-xs text-zinc-500">Product-feed powered</span>
            </div>
            <div className="flex gap-1">
              <button type="button" onClick={clear} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Clear conversation">
                <Trash2 size={16} />
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close assistant">
                <X size={18} />
              </button>
            </div>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 ? (
              <p className="rounded-xl bg-zinc-100 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                Tell me what you are looking for and I will search the current product feed.
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
          <form onSubmit={submit} className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <label className="sr-only" htmlFor="ai-shopping-message">Ask about products</label>
            <input
              id="ai-shopping-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={1000}
              placeholder="Ask about products…"
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-700 dark:border-zinc-700"
            />
            <button type="submit" disabled={!input.trim() || sending} className="rounded-xl bg-zinc-950 p-2.5 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950" aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950 text-white shadow-xl transition-transform hover:scale-105 dark:bg-white dark:text-zinc-950"
        aria-label={open ? "Close AI shopping assistant" : "Open AI shopping assistant"}
        aria-expanded={open}
      >
        {open ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </aside>
  );
}
