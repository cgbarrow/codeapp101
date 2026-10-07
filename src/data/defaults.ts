import type { List, Subtask, Task } from "./repo";

/** Field values a repository applies when a create call leaves them out. */
export const listDefaults: Omit<List, "id" | "name"> = {
  sortOrder: 0,
  isInbox: false,
  isArchived: false,
};

export const taskDefaults: Omit<Task, "id" | "listId" | "title"> = {
  notes: "",
  dueDate: null,
  hasTime: false,
  reminderAt: null,
  reminderEmailSentAt: null,
  isCompleted: false,
  completedOn: null,
  recurrence: "none",
  recurrenceParentId: null,
  sortOrder: 0,
};

export const subtaskDefaults: Omit<Subtask, "id" | "taskId" | "title"> = {
  isDone: false,
  sortOrder: 0,
};

/** Copies an input object without its undefined fields, so they cannot overwrite defaults. */
export function definedOnly<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
