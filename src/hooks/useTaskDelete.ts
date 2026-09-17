import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "@/components/Toast/useToast";
import { queryKeys } from "@/data/keys";
import { useCreateTask, useDeleteTask, type CreateTaskInput } from "@/data/queries";
import type { Subtask, Task } from "@/data/repo";
import { useRepos } from "@/data/useRepos";
import { UNDO_MS } from "./useTaskToggle";

/** The task and its subtasks without ids, ready to create them again. */
function recreateInput(task: Task, subtasks: readonly Subtask[]): CreateTaskInput {
  const fields: Partial<Task> = { ...task };
  delete fields.id;
  return {
    ...(fields as CreateTaskInput),
    subtasks: subtasks.map(({ title, isDone, sortOrder }) => ({ title, isDone, sortOrder })),
  };
}

/**
 * Deletes a task at once and offers Undo, which creates it again from a snapshot. The server stays
 * the source of truth throughout; a deferred delete could be undone by any refetch in the window.
 * Dataverse deletes subtasks with their task, so the snapshot includes them: from the cache when
 * loaded, otherwise fetched before the delete is sent.
 */
export function useTaskDelete() {
  const { mutateAsync: deleteTask } = useDeleteTask();
  const { mutateAsync: createTask } = useCreateTask();
  const { subtasks: subtaskRepo } = useRepos();
  const queryClient = useQueryClient();
  const toast = useToast();

  return useCallback(
    function remove(task: Task) {
      const failed = () =>
        toast.show({
          tone: "error",
          message: `Couldn't delete ${task.title}.`,
          action: { label: "Retry", onAction: () => remove(task) },
        });

      function send(subtasks: readonly Subtask[]) {
        let undoToastId: string | null = null;

        function restore() {
          createTask(recreateInput(task, subtasks)).catch(() =>
            toast.show({
              tone: "error",
              message: `Couldn't restore ${task.title}.`,
              action: { label: "Retry", onAction: restore },
            }),
          );
        }

        deleteTask(task.id).catch(() => {
          if (undoToastId) toast.dismiss(undoToastId);
          failed();
        });

        undoToastId = toast.show({
          message: `Deleted ${task.title}`,
          durationMs: UNDO_MS,
          action: { label: "Undo", onAction: restore },
        });
      }

      const cached = queryClient.getQueryData<Subtask[]>(queryKeys.subtasksByTask(task.id));
      if (cached) send(cached);
      // Never delete what Undo could not bring back.
      else subtaskRepo.getByTask(task.id).then(send, failed);
    },
    [deleteTask, createTask, subtaskRepo, queryClient, toast],
  );
}
