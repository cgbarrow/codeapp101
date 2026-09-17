import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Checkmark } from "@/components/Checkmark/Checkmark";
import { DeleteIcon, DownIcon, UpIcon } from "@/components/ListNav/icons";
import { useToast } from "@/components/Toast/useToast";
import {
  useCreateSubtask,
  useDeleteSubtask,
  useReorderSubtasks,
  useSubtasks,
  useUpdateSubtask,
} from "@/data/queries";
import type { Subtask, SubtaskPatch } from "@/data/repo";
import { reorderLists } from "@/features/lists/reorderLists";
import styles from "./SubtaskList.module.css";

/** SPEC S7: a task holds at most this many subtasks. */
export const MAX_SUBTASKS = 50;

const isUnsaved = (id: string) => id.startsWith("optimistic-");

const isPlainEnter = (event: KeyboardEvent) =>
  event.key === "Enter" && !event.nativeEvent.isComposing;

type SubtaskListProps = { taskId: string };

/** The checklist inside a task's detail panel. Completing every step leaves the task open. */
export function SubtaskList({ taskId }: SubtaskListProps) {
  const id = useId();
  const subtasks = useSubtasks(taskId);
  const { mutate: create } = useCreateSubtask();
  const { mutate: update } = useUpdateSubtask();
  const { mutate: remove } = useDeleteSubtask();
  const { mutate: reorder } = useReorderSubtasks();
  const toast = useToast();
  const [atLimit, setAtLimit] = useState(false);

  const items = subtasks.data ?? [];
  const saved = items.filter((subtask) => !isUnsaved(subtask.id));
  const done = items.filter((subtask) => subtask.isDone).length;
  const limitReached = atLimit && items.length >= MAX_SUBTASKS;

  function failed(message: string, retry: () => void) {
    toast.show({ tone: "error", message, action: { label: "Retry", onAction: retry } });
  }

  function add(input: HTMLInputElement) {
    const title = input.value.trim();
    if (!title) return;
    if (items.length >= MAX_SUBTASKS) {
      setAtLimit(true);
      return;
    }
    const sortOrder = items.length === 0 ? 0 : items[items.length - 1].sortOrder + 1;
    const save = () =>
      create(
        { taskId, title, sortOrder },
        { onError: () => failed(`Couldn't add ${title}.`, save) },
      );
    save();
    input.value = "";
  }

  function save(subtask: Subtask, patch: SubtaskPatch) {
    const send = () =>
      update(
        { id: subtask.id, taskId, patch },
        { onError: () => failed(`Couldn't save ${subtask.title}.`, send) },
      );
    send();
  }

  function deleteSubtask(subtask: Subtask) {
    setAtLimit(false);
    const send = () =>
      remove(
        { id: subtask.id, taskId },
        { onError: () => failed(`Couldn't delete ${subtask.title}.`, send) },
      );
    send();
  }

  function move(subtask: Subtask, step: 1 | -1) {
    const from = saved.findIndex((item) => item.id === subtask.id);
    const { changes } = reorderLists(saved, from, from + step);
    const send = () =>
      reorder({ taskId, changes }, { onError: () => failed("Couldn't reorder subtasks.", send) });
    send();
  }

  return (
    <div className={styles.subtasks}>
      <div className={styles.header}>
        <span id={`${id}-heading`} className={styles.label}>
          Subtasks
        </span>
        {items.length > 0 && (
          <span className={styles.summary}>
            {done} of {items.length} done
          </span>
        )}
      </div>

      {subtasks.isError && (
        <div role="alert" className={styles.alert}>
          <p>Subtasks didn't load.</p>
          <button type="button" className={styles.textButton} onClick={() => subtasks.refetch()}>
            Try again
          </button>
        </div>
      )}

      <ul className={styles.items} aria-labelledby={`${id}-heading`} aria-busy={subtasks.isPending}>
        {items.map((subtask, index) => (
          <SubtaskItem
            key={subtask.id}
            subtask={subtask}
            position={index + 1}
            isFirst={saved[0]?.id === subtask.id}
            isLast={saved[saved.length - 1]?.id === subtask.id}
            onToggle={() => save(subtask, { isDone: !subtask.isDone })}
            onRename={(title) => save(subtask, { title })}
            onMove={(step) => move(subtask, step)}
            onDelete={() => deleteSubtask(subtask)}
          />
        ))}
      </ul>

      <input
        className={styles.input}
        data-add
        placeholder="Add a subtask"
        aria-label="Add a subtask"
        aria-invalid={limitReached || undefined}
        aria-describedby={limitReached ? `${id}-limit` : undefined}
        maxLength={400}
        autoComplete="off"
        disabled={isUnsaved(taskId)}
        onChange={() => setAtLimit(false)}
        onKeyDown={(event) => {
          if (!isPlainEnter(event)) return;
          event.preventDefault();
          add(event.currentTarget);
        }}
      />
      <p id={`${id}-limit`} className={styles.message} aria-live="polite">
        {limitReached ? `A task can have up to ${MAX_SUBTASKS} subtasks.` : ""}
      </p>
    </div>
  );
}

type SubtaskItemProps = {
  subtask: Subtask;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onRename: (title: string) => void;
  onMove: (step: 1 | -1) => void;
  onDelete: () => void;
};

function SubtaskItem({
  subtask,
  position,
  isFirst,
  isLast,
  onToggle,
  onRename,
  onMove,
  onDelete,
}: SubtaskItemProps) {
  const unsaved = isUnsaved(subtask.id);
  const [draft, setDraft] = useState(subtask.title);
  const [shownTitle, setShownTitle] = useState(subtask.title);
  // Follow a title changed elsewhere, such as by a refetch or a rolled-back save.
  if (subtask.title !== shownTitle) {
    setShownTitle(subtask.title);
    setDraft(subtask.title);
  }

  function commit() {
    const title = draft.trim();
    if (!title) {
      setDraft(subtask.title);
      return;
    }
    if (title !== subtask.title) onRename(title);
  }

  return (
    <li
      className={styles.item}
      data-done={subtask.isDone || undefined}
      data-state={unsaved ? "loading" : undefined}
    >
      <Checkmark
        checked={subtask.isDone}
        label={`Complete ${subtask.title}`}
        onChange={onToggle}
        disabled={unsaved}
        state={unsaved ? "loading" : undefined}
      />
      <input
        className={styles.title}
        aria-label={`Subtask ${position}`}
        value={draft}
        maxLength={400}
        autoComplete="off"
        disabled={unsaved}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (!isPlainEnter(event)) return;
          event.preventDefault();
          commit();
        }}
      />
      <div className={styles.actions}>
        <IconButton
          label={`Move ${subtask.title} up`}
          disabled={unsaved || isFirst}
          onClick={() => onMove(-1)}
        >
          <UpIcon />
        </IconButton>
        <IconButton
          label={`Move ${subtask.title} down`}
          disabled={unsaved || isLast}
          onClick={() => onMove(1)}
        >
          <DownIcon />
        </IconButton>
        <IconButton label={`Delete ${subtask.title}`} disabled={unsaved} onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
      </div>
    </li>
  );
}

type IconButtonProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function IconButton({ label, disabled, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
