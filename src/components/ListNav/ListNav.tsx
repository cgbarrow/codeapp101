import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  useCreateList,
  useDeleteList,
  useInbox,
  useLists,
  useReorderLists,
  useTaskCounts,
  useUpdateList,
  type TaskCount,
} from "@/data/queries";
import type { List } from "@/data/repo";
import { reorderLists } from "@/features/lists/reorderLists";
import { ArchiveIcon, DeleteIcon, DownIcon, PlusIcon, RenameIcon, UpIcon } from "./icons";
import styles from "./ListNav.module.css";

const SAVED_FLASH_MS = 1500;

type Failure = { listId: string | null; message: string; retry: () => void };

const isOptimistic = (list: List) => list.id.startsWith("optimistic-");
const listPath = (id: string) => `/list/${id}`;

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("input, textarea, select"))
  );
}

function openTasksLabel(name: string, count: TaskCount | undefined) {
  if (!count || count.open === 0) return name;
  return `${name}, ${count.open} open ${count.open === 1 ? "task" : "tasks"}`;
}

/** Sidebar navigation for lists: switch, create, rename, reorder, archive and delete. */
export function ListNav() {
  const lists = useLists();
  const inbox = useInbox();
  const create = useCreateList();
  const update = useUpdateList();
  const reorder = useReorderLists();
  const remove = useDeleteList();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  /** Control to focus after the next render, by its `data-focus-key`. Callers also change state. */
  const pendingFocus = useRef<string | null>(null);
  const promptId = useId();

  const all = lists.data ?? [];
  const visible = all.filter((list) => !list.isArchived);
  const archived = all.filter((list) => list.isArchived);
  const saved = visible.filter((list) => !isOptimistic(list));
  const counts = useTaskCounts(saved.map((list) => list.id));
  const inboxId = inbox.data?.id ?? all.find((list) => list.isInbox)?.id;

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    navRef.current?.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  });

  useEffect(() => {
    if (!savedId) return;
    const timer = setTimeout(() => setSavedId(null), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedId]);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (!/^[1-9]$/.test(event.key) || isTypingTarget(event.target)) return;
      const list = visible[Number(event.key) - 1];
      if (!list || isOptimistic(list)) return;
      event.preventDefault();
      navigate(listPath(list.id));
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  /** Runs a mutation, flashing the row on success and offering a retry on failure. */
  function run(listId: string | null, failureMessage: string, attempt: (done: Callbacks) => void) {
    const callbacks: Callbacks = {
      onSuccess: () => {
        setFailure((current) => (current?.retry === retry ? null : current));
        if (listId) setSavedId(listId);
      },
      onError: () => setFailure({ listId, message: failureMessage, retry }),
    };
    function retry() {
      attempt(callbacks);
    }
    setFailure(null);
    attempt(callbacks);
  }

  function addList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!name) return;
    const sortOrder = Math.max(-1, ...all.map((list) => list.sortOrder)) + 1;
    setAdding(false);
    pendingFocus.current = "new-list";
    run(null, `Couldn't create ${name}.`, (done) =>
      create.mutate(
        { name, sortOrder },
        {
          onSuccess: (list) => {
            done.onSuccess();
            setSavedId(list.id);
            navigate(listPath(list.id));
          },
          onError: done.onError,
        },
      ),
    );
  }

  function rename(list: List, value: string) {
    setRenamingId(null);
    pendingFocus.current = `rename-${list.id}`;
    const name = value.trim();
    if (!name || name === list.name) return;
    run(list.id, `Couldn't rename ${list.name}.`, (done) =>
      update.mutate({ id: list.id, patch: { name } }, done),
    );
  }

  function setArchived(list: List, isArchived: boolean) {
    const verb = isArchived ? "archive" : "restore";
    run(list.id, `Couldn't ${verb} ${list.name}.`, (done) =>
      update.mutate({ id: list.id, patch: { isArchived } }, done),
    );
  }

  function move(fromIndex: number, toIndex: number) {
    const { changes } = reorderLists(saved, fromIndex, toIndex);
    if (changes.length === 0) return;
    const name = saved[fromIndex].name;
    run(saved[fromIndex].id, `Couldn't move ${name}.`, (done) => reorder.mutate(changes, done));
  }

  function requestDelete(list: List) {
    if (counts[list.id]?.total === 0) {
      deleteNow(list, null);
    } else {
      setConfirmingId(list.id);
      pendingFocus.current = `confirm-${list.id}`;
    }
  }

  function cancelDelete(list: List) {
    setConfirmingId(null);
    pendingFocus.current = `delete-${list.id}`;
  }

  function deleteNow(list: List, moveTasksTo: string | null) {
    setConfirmingId(null);
    if (pathname === listPath(list.id) && inboxId) navigate(listPath(inboxId));
    run(null, `Couldn't delete ${list.name}.`, (done) =>
      remove.mutate({ id: list.id, moveTasksTo }, done),
    );
  }

  function drop(toIndex: number) {
    if (dragFrom !== null && dragFrom !== toIndex) move(dragFrom, toIndex);
    setDragFrom(null);
    setDropTarget(null);
  }

  function rowState(list: List) {
    if (isOptimistic(list)) return "loading";
    if (failure?.listId === list.id) return "error";
    if (savedId === list.id) return "success";
    return undefined;
  }

  return (
    <div ref={navRef} className={styles.nav} data-editing={editing}>
      {lists.isError ? (
        <div role="alert" className={styles.alert}>
          <p>Your lists didn't load.</p>
          <button type="button" className={styles.button} onClick={() => lists.refetch()}>
            Try again
          </button>
        </div>
      ) : (
        failure && (
          <div role="alert" className={styles.alert}>
            <p>{failure.message}</p>
            <button type="button" className={styles.button} onClick={failure.retry}>
              Try again
            </button>
          </div>
        )
      )}

      <ul className={styles.lists} aria-label="Views">
        <li className={styles.row}>
          <NavLink to="/completed" className={styles.item}>
            <span className={styles.name}>Completed</span>
          </NavLink>
        </li>
      </ul>

      <ul className={styles.lists} aria-label="Your lists" aria-busy={lists.isPending}>
        {lists.isPending &&
          [0, 1, 2].map((index) => (
            <li key={index} className={styles.skeleton} aria-hidden="true" />
          ))}

        {visible.map((list, index) => {
          const pending = isOptimistic(list);
          const count = counts[list.id];
          const savedIndex = saved.indexOf(list);
          const confirming = confirmingId === list.id;

          return (
            <li
              key={list.id}
              className={styles.row}
              data-state={rowState(list)}
              data-drop-target={dropTarget === index || undefined}
              data-dragging={dragFrom === index || undefined}
              draggable={!pending && renamingId !== list.id}
              onDragStart={(event) => {
                setDragFrom(index);
                event.dataTransfer?.setData("text/plain", list.id);
                if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (dragFrom === null) return;
                event.preventDefault();
                setDropTarget(index);
              }}
              onDragLeave={() => setDropTarget((current) => (current === index ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                drop(index);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDropTarget(null);
              }}
            >
              {renamingId === list.id ? (
                <RenameField list={list} onCommit={rename} onCancel={() => rename(list, "")} />
              ) : (
                <NavLink
                  to={listPath(list.id)}
                  className={styles.item}
                  aria-label={openTasksLabel(list.name, count)}
                  aria-disabled={pending || undefined}
                  data-state={pending ? "loading" : undefined}
                  draggable={false}
                  onClick={(event) => pending && event.preventDefault()}
                >
                  <span className={styles.name} data-name>
                    {list.name}
                  </span>
                  {count && count.open > 0 && <span className={styles.count}>{count.open}</span>}
                </NavLink>
              )}

              {editing && !pending && (
                <div className={styles.actions}>
                  <IconButton
                    label={`Rename ${list.name}`}
                    focusKey={`rename-${list.id}`}
                    onClick={() => setRenamingId(list.id)}
                  >
                    <RenameIcon />
                  </IconButton>
                  <IconButton
                    label={`Move ${list.name} up`}
                    disabled={savedIndex === 0}
                    onClick={() => move(savedIndex, savedIndex - 1)}
                  >
                    <UpIcon />
                  </IconButton>
                  <IconButton
                    label={`Move ${list.name} down`}
                    disabled={savedIndex === saved.length - 1}
                    onClick={() => move(savedIndex, savedIndex + 1)}
                  >
                    <DownIcon />
                  </IconButton>
                  {!list.isInbox && (
                    <>
                      <IconButton
                        label={`Archive ${list.name}`}
                        onClick={() => setArchived(list, true)}
                      >
                        <ArchiveIcon />
                      </IconButton>
                      <IconButton
                        label={`Delete ${list.name}`}
                        focusKey={`delete-${list.id}`}
                        tone="danger"
                        onClick={() => requestDelete(list)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </div>
              )}

              {confirming && (
                <div
                  role="alertdialog"
                  aria-labelledby={`${promptId}-title`}
                  aria-describedby={`${promptId}-body`}
                  className={styles.prompt}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key !== "Escape") return;
                    event.nativeEvent.stopPropagation();
                    cancelDelete(list);
                  }}
                >
                  <p id={`${promptId}-title`} className={styles.promptTitle}>
                    Delete {list.name}?
                  </p>
                  <p id={`${promptId}-body`} className={styles.promptBody}>
                    {count
                      ? `${list.name} has ${count.total} ${count.total === 1 ? "task" : "tasks"}.`
                      : `${list.name} may have tasks.`}
                  </p>
                  <div className={styles.promptActions}>
                    <button
                      type="button"
                      className={styles.button}
                      data-focus-key={`confirm-${list.id}`}
                      disabled={!inboxId}
                      onClick={() => inboxId && deleteNow(list, inboxId)}
                    >
                      Move to Inbox
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      data-tone="danger"
                      onClick={() => deleteNow(list, null)}
                    >
                      Delete list and tasks
                    </button>
                    <button
                      type="button"
                      className={styles.button}
                      onClick={() => cancelDelete(list)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {editing && archived.length > 0 && (
        <section className={styles.archived} aria-labelledby={`${promptId}-archived`}>
          <h2 id={`${promptId}-archived`} className={styles.heading}>
            Archived
          </h2>
          <ul aria-label="Archived lists" className={styles.lists}>
            {archived.map((list) => (
              <li key={list.id} className={styles.archivedRow} data-state={rowState(list)}>
                <span className={styles.name}>{list.name}</span>
                <button
                  type="button"
                  className={styles.button}
                  aria-label={`Restore ${list.name}`}
                  onClick={() => setArchived(list, false)}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {adding && (
        <form className={styles.addForm} onSubmit={addList}>
          <input
            name="name"
            className={styles.input}
            aria-label="List name"
            autoComplete="off"
            maxLength={100}
            autoFocus
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.nativeEvent.stopPropagation();
              setAdding(false);
              pendingFocus.current = "new-list";
            }}
          />
        </form>
      )}

      <div className={styles.toolbar}>
        {!adding && (
          <button
            type="button"
            className={styles.button}
            data-focus-key="new-list"
            disabled={lists.isPending || lists.isError}
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            New list
          </button>
        )}
        <button
          type="button"
          className={styles.button}
          disabled={lists.isPending || lists.isError}
          onClick={() => {
            setEditing((value) => !value);
            setRenamingId(null);
            setConfirmingId(null);
          }}
        >
          {editing ? "Done" : "Edit lists"}
        </button>
      </div>
    </div>
  );
}

type Callbacks = { onSuccess: () => void; onError: () => void };

type IconButtonProps = {
  label: string;
  focusKey?: string;
  disabled?: boolean;
  tone?: "danger";
  onClick: () => void;
  children: ReactNode;
};

function IconButton({ label, focusKey, disabled, tone, onClick, children }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      data-focus-key={focusKey}
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

type RenameFieldProps = {
  list: List;
  onCommit: (list: List, value: string) => void;
  onCancel: () => void;
};

function RenameField({ list, onCommit, onCancel }: RenameFieldProps) {
  const settled = useRef(false);

  function settle(action: () => void) {
    if (settled.current) return;
    settled.current = true;
    action();
  }

  return (
    <input
      className={styles.input}
      aria-label={`Rename ${list.name}`}
      defaultValue={list.name}
      autoComplete="off"
      maxLength={100}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => {
        const value = event.currentTarget.value;
        settle(() => onCommit(list, value));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          const value = event.currentTarget.value;
          settle(() => onCommit(list, value));
        } else if (event.key === "Escape") {
          event.nativeEvent.stopPropagation();
          settle(onCancel);
        }
      }}
    />
  );
}
