import { useCallback, useEffect, useRef, useState } from "react";
import { COMPLETION_MS } from "@/components/Checkmark/Checkmark";
import { useToast } from "@/components/Toast/useToast";
import { useToggleTask } from "@/data/queries";
import type { Task } from "@/data/repo";

/** How long Undo stays on screen after a completion. */
export const UNDO_MS = 3000;
/** How long a just-completed row stays in place: the tick animation, then a beat to see it. */
export const LINGER_MS = COMPLETION_MS + 300;

/**
 * Toggles tasks with the app's feedback: an Undo toast after completing, a Retry toast when the
 * save fails, and a short linger so a completed row animates before it moves to Completed.
 */
export function useTaskToggle() {
  const { mutateAsync } = useToggleTask();
  const toast = useToast();
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const stopLingering = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setLingering((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const toggle = useCallback(
    function toggle(task: Task) {
      const isCompleted = !task.isCompleted;
      let undoToastId: string | null = null;

      if (isCompleted) {
        stopLingering(task.id);
        setLingering((current) => new Set(current).add(task.id));
        timers.current.set(
          task.id,
          setTimeout(() => stopLingering(task.id), LINGER_MS),
        );
      }

      // mutateAsync, not per-call callbacks, which a later toggle would silently replace.
      mutateAsync({ id: task.id, isCompleted }).catch(() => {
        stopLingering(task.id);
        if (undoToastId) toast.dismiss(undoToastId);
        toast.show({
          tone: "error",
          message: `Couldn't ${isCompleted ? "complete" : "reopen"} ${task.title}.`,
          action: { label: "Retry", onAction: () => toggle(task) },
        });
      });

      if (isCompleted) {
        undoToastId = toast.show({
          message: `Completed ${task.title}`,
          durationMs: UNDO_MS,
          action: {
            label: "Undo",
            onAction: () => {
              stopLingering(task.id);
              mutateAsync({ id: task.id, isCompleted: false, undo: true }).catch(() =>
                toast.show({
                  tone: "error",
                  message: `Couldn't undo. ${task.title} is still completed.`,
                  action: {
                    label: "Retry",
                    onAction: () => toggle({ ...task, isCompleted: true }),
                  },
                }),
              );
            },
          },
        });
      }
    },
    [mutateAsync, toast, stopLingering],
  );

  return { toggle, lingering };
}
