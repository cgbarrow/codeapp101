import { memo, type ReactNode } from "react";
import { Checkmark } from "@/components/Checkmark/Checkmark";
import type { SubtaskProgress } from "@/data/queries";
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
  /** Done and total subtasks, shown as `2/5` when the task has any. */
  progress?: SubtaskProgress;
  /** Shown in views that mix lists, such as Completed. */
  listName?: string;
  /** Makes the title a disclosure button for the task's detail panel. */
  onOpen?: (task: Task) => void;
  isOpen?: boolean;
  /** The id of the detail panel the title controls while open. */
  detailId?: string;
  onSelect?: (task: Task) => void;
  isSelected?: boolean;
  /** The detail panel, rendered inside the row below its summary. */
  children?: ReactNode;
};

export const TaskRow = memo(function TaskRow({
  task,
  now,
  onToggle,
  state,
  progress,
  listName,
  onOpen,
  isOpen = false,
  detailId,
  onSelect,
  isSelected = false,
  children,
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
      data-selected={isSelected || undefined}
      data-open={isOpen || undefined}
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
        {onOpen ? (
          <button
            type="button"
            className={styles.title}
            data-title
            data-task-id={task.id}
            aria-expanded={isOpen}
            aria-controls={isOpen ? detailId : undefined}
            onClick={() => onOpen(task)}
            onFocus={() => onSelect?.(task)}
          >
            {task.title}
          </button>
        ) : (
          <span className={styles.title} data-title>
            {task.title}
          </span>
        )}
        {(task.dueDate || progress || listName) && (
          <span className={styles.meta}>
            {task.dueDate && (
              <span className={styles.due} data-due>
                {overdue && <span className={styles.visuallyHidden}>Overdue: </span>}
                {formatDue(task.dueDate, task.hasTime, now)}
              </span>
            )}
            {progress && (
              <span className={styles.progress} data-progress>
                <span aria-hidden="true">
                  {progress.done}/{progress.total}
                </span>
                <span className={styles.visuallyHidden}>
                  {progress.done} of {progress.total} subtasks done
                </span>
              </span>
            )}
            {listName && <span className={styles.list}>{listName}</span>}
          </span>
        )}
      </div>
      {children && <div className={styles.detail}>{children}</div>}
    </li>
  );
});
