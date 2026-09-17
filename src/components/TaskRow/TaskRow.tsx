import { memo } from "react";
import { Checkmark } from "@/components/Checkmark/Checkmark";
import type { Task } from "@/data/repo";
import { formatDue } from "@/features/tasks/formatDue";
import { isOverdue } from "@/features/tasks/orderTasks";
import styles from "./TaskRow.module.css";

export type TaskRowState = "loading" | "error" | "success";

type TaskRowProps = {
  task: Task;
  now: Date;
  onToggle: (task: Task) => void;
  /** Save status of this row: pending, failed, or just completed. */
  state?: TaskRowState;
  /** Shown in views that mix lists, such as Completed. */
  listName?: string;
};

export const TaskRow = memo(function TaskRow({
  task,
  now,
  onToggle,
  state,
  listName,
}: TaskRowProps) {
  const unsaved = task.id.startsWith("optimistic-");
  const overdue = isOverdue(task, now);
  const rowState = unsaved ? "loading" : state;

  return (
    <li
      className={styles.row}
      data-state={rowState}
      data-overdue={overdue || undefined}
      data-completed={task.isCompleted || undefined}
      aria-disabled={unsaved || undefined}
    >
      <Checkmark
        checked={task.isCompleted}
        label={`Complete ${task.title}`}
        onChange={() => onToggle(task)}
        disabled={unsaved}
        state={rowState === "success" ? undefined : rowState}
      />
      <div className={styles.body}>
        <span className={styles.title} data-title>
          {task.title}
        </span>
        {(task.dueDate || listName) && (
          <span className={styles.meta}>
            {task.dueDate && (
              <span className={styles.due} data-due>
                {overdue && <span className={styles.visuallyHidden}>Overdue: </span>}
                {formatDue(task.dueDate, task.hasTime, now)}
              </span>
            )}
            {listName && <span className={styles.list}>{listName}</span>}
          </span>
        )}
      </div>
    </li>
  );
});
