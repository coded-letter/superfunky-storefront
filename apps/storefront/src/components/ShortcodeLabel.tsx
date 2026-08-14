import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy } from "lucide-react";
import { buildShortcode, type ShortcodeAttrValue } from "../lib/shortcodeSyntax";

export type { ShortcodeAttrValue } from "../lib/shortcodeSyntax";

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

export function ShortcodeLabel({ name, attrs }: { name: string; attrs: Record<string, ShortcodeAttrValue> }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();

  const shortcode = buildShortcode(name, attrs);

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 8;
    const width = Math.min(576, window.innerWidth - viewportPadding * 2);
    const roomToRight = window.innerWidth - rect.left - viewportPadding;
    const roomToLeft = rect.right - viewportPadding;
    const left = roomToRight >= roomToLeft
      ? Math.min(rect.left, window.innerWidth - width - viewportPadding)
      : Math.max(viewportPadding, rect.right - width);
    const roomBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
    const roomAbove = rect.top - viewportPadding - gap;
    const openBelow = roomBelow >= Math.min(208, roomAbove);
    const maxHeight = Math.max(96, Math.min(208, openBelow ? roomBelow : roomAbove));
    const top = openBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight);

    setPosition({ left, top, width, maxHeight });
  };

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
  }, [isOpen, shortcode]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleViewportChange = () => updatePosition();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !popoverRef.current?.contains(target)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleTrigger = async () => {
    setIsOpen((open) => !open);
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(shortcode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyFailed(true);
      setIsOpen(true);
    }
  };

  return (
    <span className="sf-shortcode-label inline-flex h-9 max-w-full self-center align-middle">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTrigger}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={`Copy and ${isOpen ? "close" : "show"} ${name} shortcode`}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 shadow-soft outline-none transition hover:border-brand-300 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-brand-600 dark:hover:text-brand-400"
      >
        {copied ? <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> : <Copy className="h-4 w-4 shrink-0 text-brand-500 dark:text-brand-400" aria-hidden="true" />}
        <span>{copied ? "Copied" : "Shortcode"}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && position
        ? createPortal(
            <div
              ref={popoverRef}
              id={popoverId}
              role="dialog"
              aria-label={`${name} shortcode`}
              className="fixed z-[100] flex items-start gap-2 overflow-auto overscroll-contain rounded-xl border border-zinc-200 bg-white p-3 shadow-soft-lg dark:border-zinc-700 dark:bg-zinc-900"
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              <code className="min-w-max flex-1 whitespace-pre font-mono text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
                {shortcode}
              </code>
              <button
                type="button"
                onClick={handleTrigger}
                aria-label="Copy shortcode again"
                className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-400 transition hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              {copyFailed ? (
                <span className="sr-only" role="status">Clipboard access failed. Select the visible shortcode to copy it manually.</span>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
