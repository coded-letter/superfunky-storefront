import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "default" | "success" | "error";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms — set to 0 to keep the toast until manually dismissed. */
  durationMs?: number;
  action?: ToastAction;
};

export type Toast = ToastInput & { id: string };

export type ToastContextValue = {
  toasts: Toast[];
  showToast: (toast: ToastInput) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION_MS = 3200;

/**
 * Lightweight, mockup-only toast/snackbar store — used for non-disruptive feedback
 * (e.g. "Added to cart") that shouldn't force other UI (like the cart drawer) open.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((previous) => [...previous, { ...toast, id }]);
      const duration = toast.durationMs ?? DEFAULT_DURATION_MS;
      if (duration > 0) {
        const timer = setTimeout(() => dismissToast(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ toasts, showToast, dismissToast }), [toasts, showToast, dismissToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
