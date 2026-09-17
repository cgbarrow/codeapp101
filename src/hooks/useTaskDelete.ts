import { useCallback } from "react";
import { useToast } from "@/components/Toast/useToast";
import { useCreateTask, useDeleteTask } from "@/data/queries";
import type { NewTask, Task } from "@/data/repo";
import { UNDO_MS } from "./useTaskToggle";

/** The task's fields without its id, ready to create it again. */
function withoutId(task: Task): NewTask {
  const fields: Partial<Task> = { ...task };
  delete fields.id;
  return fields as NewTask;
}

/**
 * Deletes a task at once and offers Undo, which creates it again from a snapshot. The server stays
 * the source of truth throughout; a deferred delete could be undone by any refetch in the window.
 */
export function useTaskDelete() {
  const { mutate: deleteTask } = useDeleteTask();
  const { mutate: createTask } = useCreateTask();
  const toast = useToast();

  return useCallback(
    function remove(task: Task) {
      let undoToastId: string | null = null;

      function restore() {
        createTask(withoutId(task), {
          onError: () =>
            toast.show({
              tone: "error",
              message: `Couldn't restore ${task.title}.`,
              action: { label: "Retry", onAction: restore },
            }),
        });
      }

      deleteTask(task.id, {
        onError: () => {
          if (undoToastId) toast.dismiss(undoToastId);
          toast.show({
            tone: "error",
            message: `Couldn't delete ${task.title}.`,
            action: { label: "Retry", onAction: () => remove(task) },
          });
        },
      });

      undoToastId = toast.show({
        message: `Deleted ${task.title}`,
        durationMs: UNDO_MS,
        action: { label: "Undo", onAction: restore },
      });
    },
    [deleteTask, createTask, toast],
  );
}
