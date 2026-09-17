import { useId, useRef, useState, type KeyboardEvent } from "react";
import styles from "./DateField.module.css";

export type DueValue = { dueDate: Date | null; hasTime: boolean };

type DateFieldProps = DueValue & {
  /** Called on blur or Enter, and only when the date or time actually changed. */
  onCommit: (next: DueValue) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toDateValue = (date: Date | null) =>
  date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : "";
const toTimeValue = (date: Date | null, hasTime: boolean) =>
  date && hasTime ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : "";

/** Reads the native inputs' "YYYY-MM-DD" and "HH:MM" values as a local date and time. */
function readInputs(dateValue: string, timeValue: string): DueValue {
  const [year, month, day] = dateValue.split("-").map(Number);
  if (!dateValue || !year || !month || !day) return { dueDate: null, hasTime: false };
  const [hours, minutes] = timeValue ? timeValue.split(":").map(Number) : [0, 0];
  return { dueDate: new Date(year, month - 1, day, hours, minutes), hasTime: timeValue !== "" };
}

const sameDue = (a: DueValue, b: DueValue) =>
  a.hasTime === b.hasTime && (a.dueDate?.getTime() ?? null) === (b.dueDate?.getTime() ?? null);

/** Native date and time inputs, so every platform shows its own accessible picker. */
export function DateField({ dueDate, hasTime, onCommit }: DateFieldProps) {
  const id = useId();
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const [hasDateValue, setHasDateValue] = useState(dueDate !== null);

  function commit(next = readInputs(dateRef.current!.value, timeRef.current!.value)) {
    if (!sameDue(next, { dueDate, hasTime })) onCommit(next);
  }

  function commitOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  }

  function clearTime() {
    timeRef.current!.value = "";
    timeRef.current!.focus();
    commit();
  }

  function clearDate() {
    dateRef.current!.value = "";
    timeRef.current!.value = "";
    setHasDateValue(false);
    dateRef.current!.focus();
    commit({ dueDate: null, hasTime: false });
  }

  return (
    <div className={styles.dateField}>
      <div className={styles.field}>
        <label htmlFor={`${id}-date`} className={styles.label}>
          Due date
        </label>
        <div className={styles.row}>
          <input
            ref={dateRef}
            id={`${id}-date`}
            type="date"
            className={styles.input}
            defaultValue={toDateValue(dueDate)}
            onChange={(event) => setHasDateValue(event.target.value !== "")}
            onBlur={() => commit()}
            onKeyDown={commitOnEnter}
          />
          {dueDate && (
            <button type="button" className={styles.clear} onClick={clearDate}>
              Clear due date
            </button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor={`${id}-time`} className={styles.label}>
          Time
        </label>
        <div className={styles.row}>
          <input
            ref={timeRef}
            id={`${id}-time`}
            type="time"
            className={styles.input}
            defaultValue={toTimeValue(dueDate, hasTime)}
            disabled={!hasDateValue}
            aria-describedby={hasDateValue ? undefined : `${id}-time-hint`}
            onBlur={() => commit()}
            onKeyDown={commitOnEnter}
          />
          {dueDate && hasTime && (
            <button type="button" className={styles.clear} onClick={clearTime}>
              Clear time
            </button>
          )}
        </div>
        {!hasDateValue && (
          <p id={`${id}-time-hint`} className={styles.hint}>
            Set a date first.
          </p>
        )}
      </div>
    </div>
  );
}
