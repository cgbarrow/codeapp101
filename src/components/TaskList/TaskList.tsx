import { useEffect, useId, useRef, useState } from "react";
import { TaskDetail } from "@/components/TaskDetail/TaskDetail";
import { TaskRow } from "@/components/TaskRow/TaskRow";
import { useSubtaskProgress, useTasks } from "@/data/queries";
import { orderCompletedTasks, orderOpenTasks } from "@/features/tasks/orderTasks";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import { useTaskToggle } from "@/hooks/useTaskToggle";
import styles from "./TaskList.module.css";

type TaskListProps = {
  listId: string;
  listName: string;
  now?: Date;
};

/** The tasks of one list: open tasks first, completed ones in a collapsed section. */
export function TaskList({ listId, listName, now = new Date() }: TaskListProps) {
  const tasks = useTasks(listId);
  const { toggle, lingering } = useTaskToggle();
  const removeTask = useTaskDelete();
  const [showCompleted, setShowCompleted] = useState(false);
  const completedId = useId();
  const detailId = useId();
  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      toggle(task);
    },
    Backspace: () => deleteSelected(),
    Delete: () => deleteSelected(),
  });

  /** Tasks in the order they appear on screen, so j and k follow what the user sees. */
  function visibleTasks() {
    return showCompleted ? [...open, ...completed] : open;
  }

  function selectedTask() {
    return visibleTasks().find((task) => task.id === selectedId);
  }

  function select(id: string) {
    setSelectedId(id);
    containerRef.current?.querySelector<HTMLElement>(`[data-task-id="${id}"]`)?.focus();
  }

  function moveSelection(step: 1 | -1) {
    const tasks = visibleTasks();
    if (tasks.length === 0) return false;
    const index = tasks.findIndex((task) => task.id === selectedId);
    const next =
      index === -1
        ? step === 1
          ? 0
          : tasks.length - 1
        : Math.min(Math.max(index + step, 0), tasks.length - 1);
    select(tasks[next].id);
  }

  function deleteSelected() {
    const tasks = visibleTasks();
    const index = tasks.findIndex((task) => task.id === selectedId);
    if (index === -1) return false;
    const task = tasks[index];
    const neighbour = tasks[index + 1] ?? tasks[index - 1];
    if (openId === task.id) setOpenId(null);
    if (neighbour) select(neighbour.id);
    else setSelectedId(null);
    removeTask(task);
  }

  function closeDetail(id: string) {
    setOpenId(null);
    returnFocusTo.current = id;
  }

  const all = tasks.data ?? [];
  // A just-completed task keeps its open position until its tick animation has played.
  const open = orderOpenTasks(
    all.map((task) => (lingering.has(task.id) ? { ...task, isCompleted: false } : task)),
    now,
  ).map((placed) => all.find((task) => task.id === placed.id)!);
  const completed = orderCompletedTasks(all.filter((task) => !lingering.has(task.id)));

  const progress = useSubtaskProgress(
    visibleTasks()
      .map((task) => task.id)
      .filter((id) => !id.startsWith("optimistic-")),
  );

  function row(task: (typeof all)[number], state?: "success") {
    const isOpen = openId === task.id;
    return (
      <TaskRow
        key={task.id}
        task={task}
        now={now}
        onToggle={toggle}
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

  return (
    <div ref={containerRef} className={styles.taskList}>
      {tasks.isError && (
        <div role="alert" className={styles.alert}>
          <p>{listName} didn't load.</p>
          <button type="button" className={styles.button} onClick={() => tasks.refetch()}>
            Try again
          </button>
        </div>
      )}

      <ul className={styles.rows} aria-label="Open tasks" aria-busy={tasks.isPending}>
        {tasks.isPending &&
          [0, 1, 2].map((index) => (
            <li key={index} className={styles.skeleton} aria-hidden="true" />
          ))}
        {open.map((task) => row(task, lingering.has(task.id) ? "success" : undefined))}
      </ul>

      {tasks.isSuccess && all.length === 0 && (
        <p className={styles.empty}>No tasks in {listName}.</p>
      )}

      {completed.length > 0 && (
        <section className={styles.completed}>
          <h2 className={styles.completedHeading}>
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={showCompleted}
              aria-controls={showCompleted ? completedId : undefined}
              onClick={() => setShowCompleted((value) => !value)}
            >
              <svg
                className={styles.chevron}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
              Completed ({completed.length})
            </button>
          </h2>
          {showCompleted && (
            <ul id={completedId} className={styles.rows} aria-label="Completed tasks">
              {completed.map((task) => row(task))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
