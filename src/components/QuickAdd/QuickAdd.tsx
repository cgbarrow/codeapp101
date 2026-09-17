import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useToast } from "@/components/Toast/useToast";
import { useCreateTask, useTasks } from "@/data/queries";
import type { NewTask } from "@/data/repo";
import { parseQuickAdd } from "@/features/quickadd/parseQuickAdd";
import { formatDue } from "@/features/tasks/formatDue";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import styles from "./QuickAdd.module.css";

type QuickAddProps = {
  /** The list new tasks go into. */
  listId: string;
  now?: Date;
};

/** One-line capture: type, see the parsed date, press Enter. Stays focused for the next task. */
export function QuickAdd({ listId, now = new Date() }: QuickAddProps) {
  const [text, setText] = useState("");
  const [dateDismissed, setDateDismissed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tasks = useTasks(listId);
  const { mutate } = useCreateTask();
  const toast = useToast();
  const inputId = useId();

  useKeyboardShortcuts({ n: () => inputRef.current?.focus() });

  const parsed = parseQuickAdd(text, now);
  const withDate = dateDismissed ? null : parsed.dueDate;
  const chipLabel = withDate
    ? formatDue(withDate, parsed.hasTime, now) +
      (parsed.recurrence === "none" ? "" : `, repeats ${parsed.recurrence}`)
    : null;

  function save(input: NewTask) {
    mutate(input, {
      onError: () =>
        toast.show({
          tone: "error",
          message: `Couldn't add ${input.title}.`,
          action: { label: "Retry", onAction: () => save(input) },
        }),
    });
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim()) {
      inputRef.current?.focus();
      return;
    }
    const title = dateDismissed ? text.trim() : parsed.title;
    const sortOrder = Math.max(-1, ...(tasks.data ?? []).map((task) => task.sortOrder)) + 1;
    save({
      listId,
      title,
      sortOrder,
      dueDate: dateDismissed ? null : parsed.dueDate,
      hasTime: dateDismissed ? false : parsed.hasTime,
      recurrence: dateDismissed ? "none" : parsed.recurrence,
    });
    setText("");
    setDateDismissed(false);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Handled here rather than by implicit form submission, which not every key source triggers.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key !== "Escape") return;
    event.nativeEvent.stopPropagation();
    setText("");
    setDateDismissed(false);
    inputRef.current?.blur();
  }

  return (
    <form className={styles.quickAdd} onSubmit={submit}>
      <button
        type="button"
        className={styles.add}
        aria-label="Add task"
        onClick={() => (text.trim() ? submit() : inputRef.current?.focus())}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 5v14M5 12h14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <label htmlFor={inputId} className={styles.visuallyHidden}>
        Add a task
      </label>
      <input
        ref={inputRef}
        className={styles.input}
        id={inputId}
        placeholder="Buy milk on Friday"
        autoComplete="off"
        enterKeyHint="done"
        maxLength={400}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          if (!event.target.value.trim()) setDateDismissed(false);
        }}
        onKeyDown={onKeyDown}
      />
      <kbd className={styles.hint} aria-hidden="true">
        n
      </kbd>
      {chipLabel && (
        <button
          type="button"
          className={styles.chip}
          aria-label={`Remove date ${chipLabel}`}
          onClick={() => {
            setDateDismissed(true);
            inputRef.current?.focus();
          }}
        >
          {chipLabel}
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M6 6l12 12M18 6 6 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </form>
  );
}
