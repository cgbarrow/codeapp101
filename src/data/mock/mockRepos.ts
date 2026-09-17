import { definedOnly, listDefaults, subtaskDefaults, taskDefaults } from "../defaults";
import type { List, NewList, NewSubtask, NewTask, Repos, Subtask, Task } from "../repo";

export type MockSeed = {
  lists?: List[];
  tasks?: Task[];
  subtasks?: Subtask[];
};

export type MockReposOptions = {
  seed?: MockSeed;
  /** Delay before every call resolves, to make optimistic UI visible in dev. */
  latencyMs?: number;
  /**
   * Shares the data with other tabs, standing in for Dataverse as the one store. Pass a
   * `BroadcastChannel`. Other tabs see a change when they next fetch, as they would with Dataverse.
   */
  sync?: MockSyncChannel;
};

/** The part of `BroadcastChannel` the mock repositories use. */
export type MockSyncChannel = {
  postMessage(message: unknown): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
};

type SyncMessage =
  { type: "hello" } | { type: "state"; lists: List[]; tasks: Task[]; subtasks: Subtask[] };

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

const cloneDate = (date: Date | null) => (date ? new Date(date) : null);
const cloneList = (list: List): List => ({ ...list });
const cloneSubtask = (subtask: Subtask): Subtask => ({ ...subtask });
const cloneTask = (task: Task): Task => ({
  ...task,
  dueDate: cloneDate(task.dueDate),
  reminderAt: cloneDate(task.reminderAt),
  completedOn: cloneDate(task.completedOn),
});

const bySortOrder = (a: { sortOrder: number }, b: { sortOrder: number }) =>
  a.sortOrder - b.sortOrder;

/**
 * In-memory repositories for `npm run dev` and tests. Every value crossing the boundary is
 * copied, so callers cannot mutate the store by accident.
 */
export function createMockRepos({ seed = {}, latencyMs = 0, sync }: MockReposOptions = {}): Repos {
  const lists = new Map<string, List>();
  const tasks = new Map<string, Task>();
  const subtasks = new Map<string, Subtask>();
  replaceAll(seed);
  let nextId = 1;
  // Tabs sharing data must not create the same id, so each gets its own tag.
  const tabTag = sync ? `${Math.random().toString(36).slice(2, 8)}-` : "";
  const newId = (prefix: string) => `mock-${prefix}-${tabTag}${nextId++}`;

  function replaceAll(data: MockSeed) {
    lists.clear();
    tasks.clear();
    subtasks.clear();
    for (const list of data.lists ?? []) lists.set(list.id, cloneList(list));
    for (const task of data.tasks ?? []) tasks.set(task.id, cloneTask(task));
    for (const subtask of data.subtasks ?? []) subtasks.set(subtask.id, cloneSubtask(subtask));
  }

  function publish() {
    sync?.postMessage({
      type: "state",
      lists: [...lists.values()],
      tasks: [...tasks.values()],
      subtasks: [...subtasks.values()],
    } satisfies SyncMessage);
  }

  // A new tab asks for the data; every open tab answers, and the latest state received wins.
  sync?.addEventListener("message", ({ data }) => {
    const message = data as SyncMessage;
    if (message.type === "hello") publish();
    else if (message.type === "state") replaceAll(message);
  });
  sync?.postMessage({ type: "hello" } satisfies SyncMessage);

  async function respond<T>(work: () => T): Promise<T> {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return work();
  }

  /** Like `respond`, then shares the new state with other tabs. */
  function write<T>(work: () => T): Promise<T> {
    return respond(() => {
      const result = work();
      publish();
      return result;
    });
  }

  function mustGet<T>(map: Map<string, T>, entity: string, id: string): T {
    const value = map.get(id);
    if (!value) throw new NotFoundError(entity, id);
    return value;
  }

  function deleteTask(id: string) {
    tasks.delete(id);
    for (const subtask of [...subtasks.values()]) {
      if (subtask.taskId === id) subtasks.delete(subtask.id);
    }
  }

  return {
    lists: {
      getAll: () => respond(() => [...lists.values()].sort(bySortOrder).map(cloneList)),

      create: (input: NewList) =>
        write(() => {
          const list: List = { ...listDefaults, ...definedOnly(input), id: newId("list") } as List;
          lists.set(list.id, list);
          return cloneList(list);
        }),

      update: (id, patch) =>
        write(() => {
          const list = { ...mustGet(lists, "List", id), ...definedOnly(patch), id };
          lists.set(id, list);
          return cloneList(list);
        }),

      delete: (id) =>
        write(() => {
          mustGet(lists, "List", id);
          lists.delete(id);
          for (const task of [...tasks.values()]) {
            if (task.listId === id) deleteTask(task.id);
          }
        }),
    },

    tasks: {
      getByList: (listId) =>
        respond(() =>
          [...tasks.values()]
            .filter((task) => task.listId === listId)
            .sort(bySortOrder)
            .map(cloneTask),
        ),

      getOpenDueBefore: (end) =>
        respond(() =>
          [...tasks.values()]
            .filter(
              (task) =>
                !task.isCompleted &&
                task.dueDate !== null &&
                task.dueDate.getTime() < end.getTime(),
            )
            .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
            .map(cloneTask),
        ),

      create: (input: NewTask) =>
        write(() => {
          const task = cloneTask({
            ...taskDefaults,
            ...definedOnly(input),
            id: newId("task"),
          } as Task);
          tasks.set(task.id, task);
          return cloneTask(task);
        }),

      update: (id, patch) =>
        write(() => {
          const task = cloneTask({ ...mustGet(tasks, "Task", id), ...definedOnly(patch), id });
          tasks.set(id, task);
          return cloneTask(task);
        }),

      delete: (id) =>
        write(() => {
          mustGet(tasks, "Task", id);
          deleteTask(id);
        }),
    },

    subtasks: {
      getByTask: (taskId) =>
        respond(() =>
          [...subtasks.values()]
            .filter((subtask) => subtask.taskId === taskId)
            .sort(bySortOrder)
            .map(cloneSubtask),
        ),

      create: (input: NewSubtask) =>
        write(() => {
          const subtask: Subtask = {
            ...subtaskDefaults,
            ...definedOnly(input),
            id: newId("subtask"),
          } as Subtask;
          subtasks.set(subtask.id, subtask);
          return cloneSubtask(subtask);
        }),

      update: (id, patch) =>
        write(() => {
          const subtask = { ...mustGet(subtasks, "Subtask", id), ...definedOnly(patch), id };
          subtasks.set(id, subtask);
          return cloneSubtask(subtask);
        }),

      delete: (id) =>
        write(() => {
          mustGet(subtasks, "Subtask", id);
          subtasks.delete(id);
        }),
    },
  };
}
