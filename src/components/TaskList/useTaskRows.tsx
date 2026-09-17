import { useEffect, useId, useRef, useState } from "react";
import { TaskDetail } from "@/components/TaskDetail/TaskDetail";
import { TaskRow, type TaskRowState } from "@/components/TaskRow/TaskRow";
import { useSubtaskProgress } from "@/data/queries";
import type { Task } from "@/data/repo";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTaskDelete } from "@/hooks/useTaskDelete";

/** Asks the list to open one task's detail panel. A new `key` repeats the request. */
export type OpenTaskRequest = { taskId: string; key: string };

type UseTaskRowsOptions = {
  /** Tasks in the order they appear on screen, so j and k follow what the user sees. */
  visible: readonly Task[];
  now: Date;
  onToggle: (task: Task) => void;
  openRequest?: OpenTaskRequest;
};

/**
 * Selection, keyboard shortcuts (j, k, x, e, Backspace, Delete) and the inline detail panel for a
 * view of task rows. Put `containerRef` on an element around the rows and render each with `row`.
 */
export function useTaskRows({ visible, now, onToggle, openRequest }: UseTaskRowsOptions) {
  const removeTask = useTaskDelete();
  const detailId = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [handledRequest, setHandledRequest] = useState<string | null>(null);
  if (openRequest && openRequest.key !== handledRequest) {
    setHandledRequest(openRequest.key);
    setOpenId(openRequest.taskId);
    setSelectedId(openRequest.taskId);
  }
  const containerRef = useRef<HTMLDivElement>(null);
  /** Task whose title should take focus after the next render, when its panel closes. */
  const returnFocusTo = useRef<string | null>(null);

  useEffect(() => {
    const id = returnFocusTo.current;
    if (!id) return;
    returnFocusTo.current = null;
    containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus();
  });

  useKeyboardShortcuts({
    j: () => moveSelection(1),
    k: () => moveSelection(-1),
    e: () => {
      const task = selectedTask();
      if (!task) return false;
      setOpenId(task.id);
    },
    x: () => {
      const task = selectedTask();
      if (!task) return false;
      onToggle(task);
    },
    Backspace: () => deleteSelected(),
    Delete: () => deleteSelected(),
  });

  function selectedTask() {
    return visible.find((task) => task.id === selectedId);
  }

  function select(id: string) {
    setSelectedId(id);
    containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus();
  }

  function moveSelection(step: 1 | -1) {
    if (visible.length === 0) return false;
    const index = visible.findIndex((task) => task.id === selectedId);
    const next =
      index === -1
        ? step === 1
          ? 0
          : visible.length - 1
        : Math.min(Math.max(index + step, 0), visible.length - 1);
    select(visible[next].id);
  }

  function deleteSelected() {
    const index = visible.findIndex((task) => task.id === selectedId);
    if (index === -1) return false;
    const task = visible[index];
    const neighbour = visible[index + 1] ?? visible[index - 1];
    if (openId === task.id) setOpenId(null);
    if (neighbour) select(neighbour.id);
    else setSelectedId(null);
    removeTask(task);
  }

  function closeDetail(id: string) {
    setOpenId(null);
    returnFocusTo.current = id;
  }

  const progress = useSubtaskProgress(
    visible.map((task) => task.id).filter((id) => !id.startsWith("optimistic-")),
  );

  function row(task: Task, state?: TaskRowState) {
    const isOpen = openId === task.id;
    return (
      <TaskRow
        key={task.id}
        task={task}
        now={now}
        onToggle={onToggle}
        state={state}
        progress={progress[task.id]}
        onOpen={(opened) => setOpenId((current) => (current === opened.id ? null : opened.id))}
        isOpen={isOpen}
        detailId={detailId}
        onSelect={(selected) => setSelectedId(selected.id)}
        isSelected={selectedId === task.id}
      >
        {isOpen && <TaskDetail id={detailId} task={task} onClose={() => closeDetail(task.id)} />}
      </TaskRow>
    );
  }

  return { containerRef, row };
}
