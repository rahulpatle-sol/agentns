import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "success" | "error" | "info" | "pending";

type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
  /** Milliseconds before auto-dismiss. `0` keeps it until dismissed. */
  duration: number;
};

type ToastApi = {
  push: (
    toast: Omit<Toast, "id" | "duration"> & { duration?: number },
  ) => number;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Pending toasts are sticky: a transaction in flight must not vanish. */
function defaultDuration(tone: ToastTone): number {
  if (tone === "pending") return 0;
  if (tone === "error") return 9000;
  return 5000;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback<ToastApi["push"]>(
    (input) => {
      const id = nextId.current++;
      const duration = input.duration ?? defaultDuration(input.tone);
      const toast: Toast = { id, duration, ...input };

      setToasts((current) => [...current.slice(-3), toast]);
      if (duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback<ToastApi["update"]>(
    (id, patch) => {
      setToasts((current) =>
        current.map((toast) =>
          toast.id === id ? { ...toast, ...patch } : toast,
        ),
      );
      // Re-arm the auto-dismiss when the toast settles into a terminal state.
      if (patch.duration && patch.duration > 0) {
        const existing = timers.current.get(id);
        if (existing) clearTimeout(existing);
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), patch.duration!),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ push, update, dismiss }),
    [push, update, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
          >
            <span
              aria-hidden="true"
              style={{
                marginTop: 1,
                color:
                  toast.tone === "error"
                    ? "var(--color-danger)"
                    : toast.tone === "pending"
                      ? "var(--color-positive-ink)"
                      : "var(--color-success)",
              }}
            >
              {toast.tone === "error"
                ? "⨯"
                : toast.tone === "pending"
                  ? "◐"
                  : "✓"}
            </span>
            <div className="toast__body">
              <div className="toast__title">{toast.title}</div>
              {toast.message ? (
                <div className="toast__message">{toast.message}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="toast__close"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context)
    throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
