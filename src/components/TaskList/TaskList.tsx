import { useId, useState } from "react";
import { useTasks } from "@/data/queries";
import { orderCompletedTasks, orderOpenTasks } from "@/features/tasks/orderTasks";
import { useTaskToggle } from "@/hooks/useTaskToggle";
import styles from "./TaskList.module.css";
import { useTaskRows, type OpenTaskRequest } from "./useTaskRows";

export type { OpenTaskRequest };

type TaskListProps = {
  listId: string;
  listName: string;
  now?: Date;
  openRequest?: OpenTaskRequest;
};

/** The tasks of one list: open tasks first, completed ones in a collapsed section. */
export function TaskList({ listId, listName, now = new Date(), openRequest }: TaskListProps) {
  const tasks = useTasks(listId);
  const { toggle, lingering } = useTaskToggle();
  const [showCompleted, setShowCompleted] = useState(false);
  const completedId = useId();

  const all = tasks.data ?? [];
  // A just-completed task keeps its open position until its tick animation has played.
  const open = orderOpenTasks(
    all.map((task) => (lingering.has(task.id) ? { ...task, isCompleted: false } : task)),
    now,
  ).map((placed) => all.find((task) => task.id === placed.id)!);
  const completed = orderCompletedTasks(all.filter((task) => !lingering.has(task.id)));
  const { containerRef, row } = useTaskRows({
    visible: showCompleted ? [...open, ...completed] : open,
    now,
    onToggle: toggle,
    openRequest,
  });

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
