import { focusManager, QueryClient } from "@tanstack/react-query";

/** How often data refetches while the page is visible (SPEC S2). */
export const REFETCH_INTERVAL_MS = 60_000;
/** Attempts after the first before a failed read is shown as an error. */
const MAX_RETRIES = 2;

/**
 * Whether a failed read is worth repeating: timeouts, throttling (Dataverse service protection
 * limits answer 429), server errors, and network failures, which `fetch` reports as a TypeError.
 * Anything else, such as a 403 from a missing security role, fails at once.
 */
export function isTransientError(error: unknown) {
  if (error instanceof TypeError) return true;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status !== "number") return false;
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Focus events for TanStack Query. Its default listens only for `visibilitychange`, which does not
 * fire when the user switches between two windows that are both visible.
 */
export function listenForFocus(onFocus: () => void) {
  if (typeof window === "undefined") return;
  const listener = () => onFocus();
  window.addEventListener("focus", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.removeEventListener("focus", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}

/**
 * The app's query client. Reads refetch on focus, on becoming visible, and every 60 seconds while
 * visible, and retry transient failures. Writes never retry on their own: a create is not safe to
 * repeat, so a failed write shows a toast with Retry instead.
 */
export function createQueryClient() {
  focusManager.setEventListener(listenForFocus);
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        refetchInterval: REFETCH_INTERVAL_MS,
        refetchIntervalInBackground: false,
        retry: (failureCount, error) => failureCount < MAX_RETRIES && isTransientError(error),
      },
      mutations: { retry: false },
    },
  });
}
