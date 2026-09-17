import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskDefaults } from "@/data/defaults";
import type { Task } from "@/data/repo";
import {
  REMINDER_CHECK_MS,
  createFiredStore,
  dueReminders,
  startReminderScheduler,
} from "./scheduler";

const opened = new Date(2026, 8, 17, 9, 0, 0);

function task(fields: Partial<Task> = {}): Task {
  return {
    ...taskDefaults,
    id: "t1",
    listId: "l1",
    title: "Call Sam",
    dueDate: new Date(2026, 8, 17, 9, 10),
    hasTime: true,
    reminderAt: new Date(2026, 8, 17, 9, 0, 45),
    ...fields,
  };
}

function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

describe("startReminderScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(opened);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function start(tasks: () => Task[], storage = memoryStorage()) {
    const notify = vi.fn();
    const stop = startReminderScheduler({
      getTasks: tasks,
      notify,
      fired: createFiredStore(storage),
    });
    return { notify, stop, storage };
  }

  it("does not fire before the reminder time", () => {
    const { notify, stop } = start(() => [task()]);

    vi.advanceTimersByTime(REMINDER_CHECK_MS);

    expect(notify).not.toHaveBeenCalled();
    stop();
  });

  it("fires on the first check at or after the reminder time, within one interval", () => {
    const { notify, stop } = start(() => [task()]);

    vi.advanceTimersByTime(2 * REMINDER_CHECK_MS);

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ id: "t1" }));
    stop();
  });

  it("fires once, not again on later checks", () => {
    const { notify, stop } = start(() => [task()]);

    vi.advanceTimersByTime(10 * REMINDER_CHECK_MS);

    expect(notify).toHaveBeenCalledTimes(1);
    stop();
  });

  it("does not fire again after a reload in the same session", () => {
    const first = start(() => [task()]);
    vi.advanceTimersByTime(2 * REMINDER_CHECK_MS);
    first.stop();

    const second = start(() => [task()], first.storage);
    vi.advanceTimersByTime(2 * REMINDER_CHECK_MS);

    expect(first.notify).toHaveBeenCalledTimes(1);
    expect(second.notify).not.toHaveBeenCalled();
    second.stop();
  });

  it("fires again when the reminder is moved to a new time", () => {
    let current = task();
    const { notify, stop } = start(() => [current]);
    vi.advanceTimersByTime(2 * REMINDER_CHECK_MS);

    current = task({ reminderAt: new Date(2026, 8, 17, 9, 2) });
    vi.advanceTimersByTime(2 * REMINDER_CHECK_MS);

    expect(notify).toHaveBeenCalledTimes(2);
    stop();
  });

  it("checks the tasks as they are at each check", () => {
    let tasks: Task[] = [];
    const { notify, stop } = start(() => tasks);

    vi.advanceTimersByTime(REMINDER_CHECK_MS);
    tasks = [task()];
    vi.advanceTimersByTime(REMINDER_CHECK_MS);

    expect(notify).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops checking once stopped", () => {
    const { notify, stop } = start(() => [task()]);

    stop();
    vi.advanceTimersByTime(10 * REMINDER_CHECK_MS);

    expect(notify).not.toHaveBeenCalled();
  });
});

describe("dueReminders", () => {
  const now = new Date(2026, 8, 17, 9, 5);
  const since = new Date(2026, 8, 17, 8, 59, 30);
  const due = (tasks: Task[]) =>
    dueReminders(tasks, { now, since, fired: createFiredStore(memoryStorage()) });

  it("skips completed tasks, unsaved tasks and tasks without a reminder", () => {
    expect(
      due([
        task({ id: "done", isCompleted: true }),
        task({ id: "optimistic-1" }),
        task({ id: "none", reminderAt: null }),
      ]),
    ).toEqual([]);
  });

  it("skips reminders that passed before the app was opened", () => {
    expect(due([task({ reminderAt: new Date(2026, 8, 17, 8, 59, 0) })])).toEqual([]);
  });

  it("lists a task once even when it is in two caches", () => {
    expect(due([task(), task()])).toHaveLength(1);
  });
});

describe("createFiredStore", () => {
  it("works in memory when session storage is unavailable", () => {
    const store = createFiredStore({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    store.add("t1@2026");

    expect(store.has("t1@2026")).toBe(true);
  });
});
