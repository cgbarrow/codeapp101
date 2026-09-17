import { useEffect, useId, useRef } from "react";
import { DateField, type DueValue } from "@/components/DateField/DateField";
import { SubtaskList } from "@/components/SubtaskList/SubtaskList";
import { useToast } from "@/components/Toast/useToast";
import { useUpdateTask } from "@/data/queries";
import type { Recurrence, Task, TaskPatch } from "@/data/repo";
import {
  computeReminderAt,
  REMINDER_OFFSETS,
  reminderOffsetOf,
  type ReminderOffset,
} from "@/features/reminders/computeReminderAt";
import { useTaskDelete } from "@/hooks/useTaskDelete";
import styles from "./TaskDetail.module.css";

const REPEATS: ReadonlyArray<{ value: Recurrence; label: string }> = [
  { value: "none", label: "Never" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const sameValue = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? (a as Date | null)?.getTime() === (b as Date | null)?.getTime()
    : a === b;

/** Only the fields of `next` that differ from the task, so updates never resend unchanged columns. */
function changedFields(task: Task, next: TaskPatch): TaskPatch {
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => !sameValue(task[key as keyof Task], value)),
  ) as TaskPatch;
}

type TaskDetailProps = {
  task: Task;
  /** Element id, for the row title's aria-controls. */
  id?: string;
  onClose: () => void;
};

/** Inline editor for one task. Text fields save on blur or Enter; selects save on change. */
export function TaskDetail({ task, id: regionId, onClose }: TaskDetailProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const { mutate: update } = useUpdateTask();
  const removeTask = useTaskDelete();
  const toast = useToast();
  const offset = reminderOffsetOf(task);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // On the document, not the panel: Escape still closes it after focus has moved outside.
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function save(next: TaskPatch) {
    const patch = changedFields(task, next);
    if (Object.keys(patch).length === 0) return;
    update(
      { id: task.id, patch },
      {
        onError: () =>
          toast.show({
            tone: "error",
            message: `Couldn't save ${task.title}.`,
            action: { label: "Retry", onAction: () => update({ id: task.id, patch }) },
          }),
      },
    );
  }

  function saveTitle(input: HTMLInputElement) {
    const title = input.value.trim();
    if (!title) {
      input.value = task.title;
      return;
    }
    save({ title });
  }

  function saveDue({ dueDate, hasTime }: DueValue) {
    if (dueDate === null) {
      save({ dueDate, hasTime, reminderAt: null, recurrence: "none" });
      return;
    }
    const reminderAt =
      offset === "none" || offset === "custom"
        ? task.reminderAt
        : computeReminderAt(dueDate, hasTime, offset);
    save({ dueDate, hasTime, reminderAt });
  }

  const scheduleDisabled = task.dueDate === null;

  return (
    <>
      {/* Below 48rem the panel is a bottom sheet; this scrim sits behind it and closes it. */}
      <div
        className={styles.backdrop}
        data-testid="detail-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <section id={regionId} className={styles.detail} aria-label="Task details">
        <div className={styles.header}>
          <label htmlFor={`${id}-title`} className={styles.label}>
            Title
          </label>
          <button
            type="button"
            className={styles.close}
            aria-label="Close details"
            onClick={onClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path
                d="M6 6l12 12M18 6 6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <input
          ref={titleRef}
          id={`${id}-title`}
          className={styles.input}
          defaultValue={task.title}
          maxLength={400}
          autoComplete="off"
          onBlur={(event) => saveTitle(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            saveTitle(event.currentTarget);
          }}
        />

        <label htmlFor={`${id}-notes`} className={styles.label}>
          Notes
        </label>
        <textarea
          id={`${id}-notes`}
          className={styles.textarea}
          defaultValue={task.notes}
          rows={3}
          onBlur={(event) => save({ notes: event.currentTarget.value })}
        />

        <DateField dueDate={task.dueDate} hasTime={task.hasTime} onCommit={saveDue} />

        <div className={styles.selects}>
          <div className={styles.field}>
            <label htmlFor={`${id}-reminder`} className={styles.label}>
              Reminder
            </label>
            <select
              id={`${id}-reminder`}
              className={styles.select}
              value={offset}
              disabled={scheduleDisabled}
              aria-describedby={`${id}-schedule-hint`}
              onChange={(event) =>
                save({
                  reminderAt: computeReminderAt(
                    task.dueDate,
                    task.hasTime,
                    event.target.value as ReminderOffset,
                  ),
                })
              }
            >
              {REMINDER_OFFSETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {offset === "custom" && (
                <option value="custom" disabled>
                  Custom
                </option>
              )}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor={`${id}-repeat`} className={styles.label}>
              Repeat
            </label>
            <select
              id={`${id}-repeat`}
              className={styles.select}
              value={task.recurrence}
              disabled={scheduleDisabled}
              aria-describedby={`${id}-schedule-hint`}
              onChange={(event) => save({ recurrence: event.target.value as Recurrence })}
            >
              {REPEATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p id={`${id}-schedule-hint`} className={styles.hint}>
          {scheduleDisabled
            ? "Set a due date to add a reminder or repeat."
            : !task.hasTime
              ? "Date-only tasks remind at 9:00."
              : ""}
        </p>

        <SubtaskList taskId={task.id} />

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.delete}
            onClick={() => {
              onClose();
              removeTask(task);
            }}
          >
            Delete task
          </button>
        </div>
      </section>
    </>
  );
}
