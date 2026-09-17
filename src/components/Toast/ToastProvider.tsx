import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";
import { ToastContext, type ToastApi, type ToastInput } from "./useToast";

const MAX_TOASTS = 3;
const DEFAULT_DURATION_MS = 5000;

type ToastEntry = ToastInput & { id: string };

let toastCounter = 0;

/** Holds the toast queue and renders it in one polite live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((input: ToastInput) => {
    const id = `toast-${++toastCounter}`;
    setToasts((current) => [...current, { ...input, id }].slice(-MAX_TOASTS));
    return id;
  }, []);

  const api = useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section className={styles.region} aria-label="Notifications" aria-live="polite">
        <ol className={styles.stack}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
      </section>
    </ToastContext.Provider>
  );
}

type ToastItemProps = { toast: ToastEntry; onDismiss: (id: string) => void };

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id, message, action } = toast;
  const tone = toast.tone ?? "neutral";
  const duration =
    toast.durationMs === undefined
      ? tone === "error"
        ? null
        : DEFAULT_DURATION_MS
      : toast.durationMs;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(duration);

  // The countdown pauses while the user is pointing at or focused on the toast.
  useEffect(() => {
    if (remaining.current === null || hovered || focused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, (remaining.current ?? 0) - (Date.now() - startedAt));
    };
  }, [hovered, focused, id, onDismiss]);

  return (
    <li
      className={styles.toast}
      data-tone={tone}
      role={tone === "error" ? "alert" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <p className={styles.message}>{message}</p>
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onAction();
            onDismiss(id);
          }}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className={styles.dismiss}
        aria-label="Dismiss"
        onClick={() => onDismiss(id)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M6 6l12 12M18 6 6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </li>
  );
}
