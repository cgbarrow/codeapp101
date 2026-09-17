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
};

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
export function createMockRepos({ seed = {}, latencyMs = 0 }: MockReposOptions = {}): Repos {
  const lists = new Map((seed.lists ?? []).map((list) => [list.id, cloneList(list)]));
  const tasks = new Map((seed.tasks ?? []).map((task) => [task.id, cloneTask(task)]));
  const subtasks = new Map((seed.subtasks ?? []).map((sub) => [sub.id, cloneSubtask(sub)]));
  let nextId = 1;
  const newId = (prefix: string) => `mock-${prefix}-${nextId++}`;

  async function respond<T>(work: () => T): Promise<T> {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return work();
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
        respond(() => {
          const list: List = { ...listDefaults, ...definedOnly(input), id: newId("list") } as List;
          lists.set(list.id, list);
          return cloneList(list);
        }),

      update: (id, patch) =>
        respond(() => {
          const list = { ...mustGet(lists, "List", id), ...definedOnly(patch), id };
          lists.set(id, list);
          return cloneList(list);
        }),

      delete: (id) =>
        respond(() => {
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
        respond(() => {
          const task = cloneTask({
            ...taskDefaults,
            ...definedOnly(input),
            id: newId("task"),
          } as Task);
          tasks.set(task.id, task);
          return cloneTask(task);
        }),

      update: (id, patch) =>
        respond(() => {
          const task = cloneTask({ ...mustGet(tasks, "Task", id), ...definedOnly(patch), id });
          tasks.set(id, task);
          return cloneTask(task);
        }),

      delete: (id) =>
        respond(() => {
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
        respond(() => {
          const subtask: Subtask = {
            ...subtaskDefaults,
            ...definedOnly(input),
            id: newId("subtask"),
          } as Subtask;
          subtasks.set(subtask.id, subtask);
          return cloneSubtask(subtask);
        }),

      update: (id, patch) =>
        respond(() => {
          const subtask = { ...mustGet(subtasks, "Subtask", id), ...definedOnly(patch), id };
          subtasks.set(id, subtask);
          return cloneSubtask(subtask);
        }),

      delete: (id) =>
        respond(() => {
          mustGet(subtasks, "Subtask", id);
          subtasks.delete(id);
        }),
    },
  };
}
