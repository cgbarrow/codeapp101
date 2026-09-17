import { useCallback } from "react";
import { useToast } from "@/components/Toast/useToast";

/**
 * Runs a write and, if it fails, shows an error toast whose Retry runs it again with the same
 * handling. Pass a `mutateAsync` call, not `mutate` with an `onError` callback: TanStack Query
 * runs per-call callbacks only for the latest call on a hook, and not at all once the calling
 * component has unmounted, so a failure could pass silently. The mutation's own `onError` still
 * rolls the cache back.
 */
export function useSaveWithRetry() {
  const toast = useToast();

  return useCallback(
    function saveWithRetry(
      write: () => Promise<unknown>,
      failureMessage: string,
      onFailure?: () => void,
    ) {
      write().catch(() => {
        onFailure?.();
        toast.show({
          tone: "error",
          message: failureMessage,
          action: {
            label: "Retry",
            onAction: () => saveWithRetry(write, failureMessage, onFailure),
          },
        });
      });
    },
    [toast],
  );
}
