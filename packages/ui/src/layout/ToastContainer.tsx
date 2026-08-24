import { CheckCircle2, X, XCircle } from "lucide-react";
import { useT } from "../locale";
import { useToast, type Toast } from "../state/ToastContext";

/**
 * Fixed-position stack of transient toasts — bottom-center on mobile, bottom-right on
 * desktop, so it never collides with the cart drawer or cookie banner. Non-blocking:
 * unlike the cart drawer this never steals focus or interrupts scrolling/browsing.
 */
export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div id="sf-toasts" className="sf-toasts funky-toast-container pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={() => dismissToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const t = useT();
  const Icon = toast.tone === "error" ? XCircle : CheckCircle2;
  const iconClass = toast.tone === "error" ? "text-rose-500" : "text-brand-500 dark:text-brand-400";

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3.5 shadow-soft backdrop-blur animate-toast-in dark:border-zinc-800 dark:bg-zinc-900/95"
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{toast.title}</p>
        {toast.description ? <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{toast.description}</p> : null}
        {toast.action ? (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="mt-1.5 text-xs font-semibold text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("notification.dismiss")}
        className="shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
