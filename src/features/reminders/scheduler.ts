import type { Task } from "@/data/repo";

/** How often the open tab looks for reminders that have come due (SPEC S3). */
export const REMINDER_CHECK_MS = 30_000;

const STORAGE_KEY = "simple-todo:fired-reminders";

/** Keys of reminders already shown. A moved reminder has a new key, so it fires again. */
export type FiredStore = { has(key: string): boolean; add(key: string): void };

export const reminderKey = (task: Pick<Task, "id" | "reminderAt">) =>
  `${task.id}@${task.reminderAt?.toISOString()}`;

/**
 * Remembers fired reminders in session storage, so a reload does not show them again. Storage can
 * be missing or throw, in private windows or with site data blocked; the set in memory still works.
 */
export function createFiredStore(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeSessionStorage(),
): FiredStore {
  const keys = new Set<string>();
  try {
    const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? "[]");
    if (Array.isArray(saved)) saved.forEach((key) => typeof key === "string" && keys.add(key));
  } catch {
    // Nothing saved, or unreadable: start empty.
  }
  return {
    has: (key) => keys.has(key),
    add(key) {
      keys.add(key);
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify([...keys]));
      } catch {
        // Keep the in-memory record.
      }
    },
  };
}

function safeSessionStorage() {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

type DueOptions = {
  now: Date;
  /** Reminders at or before this time are old news and never fire. */
  since: Date;
  fired: FiredStore;
};

/** Open, saved tasks whose reminder has come due since `since` and has not been shown yet. */
export function dueReminders(tasks: readonly Task[], { now, since, fired }: DueOptions): Task[] {
  const due = new Map<string, Task>();
  for (const task of tasks) {
    const at = task.reminderAt?.getTime();
    if (at === undefined || task.isCompleted || task.id.startsWith("optimistic-")) continue;
    if (at > now.getTime() || at <= since.getTime()) continue;
    const key = reminderKey(task);
    if (!fired.has(key)) due.set(key, task);
  }
  return [...due.values()];
}

type SchedulerOptions = {
  /** The tasks to check, read afresh at every check. */
  getTasks: () => readonly Task[];
  notify: (task: Task) => void;
  fired: FiredStore;
};

/**
 * Checks now and every 30 seconds, showing each reminder once. Reminders from before the app was
 * opened, beyond one check interval, are skipped so opening the app does not replay old alerts.
 * Returns a function that stops the checks.
 */
export function startReminderScheduler({ getTasks, notify, fired }: SchedulerOptions) {
  const since = new Date(Date.now() - REMINDER_CHECK_MS);

  function check() {
    for (const task of dueReminders(getTasks(), { now: new Date(), since, fired })) {
      fired.add(reminderKey(task));
      notify(task);
    }
  }

  check();
  const timer = setInterval(check, REMINDER_CHECK_MS);
  return () => clearInterval(timer);
}
