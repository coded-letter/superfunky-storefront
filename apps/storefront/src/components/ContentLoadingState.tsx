/** Minimal content-loading indicator — a thin bar that sits at the very top of the
 *  content container, occupying no layout space. Fades in after a short delay so
 *  instant cache hits never flash it at all. */
export function ContentLoadingState({ label = "Loading content" }: { compact?: boolean; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="sf-loading pointer-events-none relative h-0 w-full overflow-visible">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px] animate-[funky-progress_1.8s_ease-in-out_infinite] rounded-full bg-brand-500/40 dark:bg-brand-400/30 [animation-delay:150ms] [opacity:0] [animation-fill-mode:forwards]"
      />
    </div>
  );
}
