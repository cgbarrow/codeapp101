import { createContext, useContext } from "react";

export type ToastTone = "neutral" | "error" | "success";

export type ToastInput = {
  message: string;
  tone?: ToastTone;
  action?: { label: string; onAction: () => void };
  /** Time on screen before it closes itself. `null` stays until dismissed; errors default to it. */
  durationMs?: number | null;
};

export type ToastApi = {
  /** Shows a toast and returns its id. */
  show: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
