import type { NewTask, Repos, Task } from "@/data/repo";
import { startOfDay } from "@/features/tasks/orderTasks";
import { computeReminderAt, reminderOffsetOf } from "@/features/reminders/computeReminderAt";
import { anchorDayOf, nextOccurrence } from "./nextOccurrence";

type FindTask = (id: string) => Task | undefined;

/**
 * The instance that follows `task` once it is completed, or `null` if it does not repeat. It is
 * open, in the same list, linked to `task` through `recurrenceParentId`, and due at the next
 * occurrence. A repeating task with no due date repeats from today.
 */
export function buildNextInstance(task: Task, findTask: FindTask, now: Date): NewTask | null {
  if (task.recurrence === "none") return null;
  const from = task.dueDate ?? startOfDay(now);
  const dueDate = nextOccurrence(
    from,
    task.recurrence,
    anchorDayOf({ ...task, dueDate: from }, findTask),
  );
  if (!dueDate) return null;

  return {
    listId: task.listId,
    title: task.title,
    notes: task.notes,
    dueDate,
    hasTime: task.dueDate ? task.hasTime : false,
    reminderAt: nextReminder(task, dueDate),
    recurrence: task.recurrence,
    recurrenceParentId: task.id,
    sortOrder: task.sortOrder,
    isCompleted: false,
    completedOn: null,
  };
}

/** A preset reminder is recomputed on the calendar; a custom one keeps its distance from the due date. */
function nextReminder(task: Task, dueDate: Date): Date | null {
  if (!task.reminderAt || !task.dueDate) return null;
  const offset = reminderOffsetOf(task);
  if (offset !== "custom") return computeReminderAt(dueDate, task.hasTime, offset);
  return new Date(dueDate.getTime() - (task.dueDate.getTime() - task.reminderAt.getTime()));
}

/**
 * Creates the next instance of a just-completed repeating task, with its subtasks copied unticked.
 * Creates nothing if the task already has a next instance, so completing it again after reopening
 * it never makes a duplicate. Returns the new task, or `null`.
 */
export async function createNextInstance(repos: Repos, task: Task, now: Date) {
  if (task.recurrence === "none") return null;
  const siblings = await repos.tasks.getByList(task.listId);
  if (siblings.some((sibling) => sibling.recurrenceParentId === task.id)) return null;

  const input = buildNextInstance(task, (id) => siblings.find((sibling) => sibling.id === id), now);
  if (!input) return null;
  const [next, subtasks] = await Promise.all([
    repos.tasks.create(input),
    repos.subtasks.getByTask(task.id),
  ]);
  for (const { title, sortOrder } of subtasks) {
    await repos.subtasks.create({ taskId: next.id, title, sortOrder, isDone: false });
  }
  return next;
}

/** Deletes the open instance created when `task` was completed, for Undo. */
export async function removeNextInstance(repos: Repos, task: Pick<Task, "id" | "listId">) {
  const siblings = await repos.tasks.getByList(task.listId);
  for (const sibling of siblings) {
    if (sibling.recurrenceParentId === task.id && !sibling.isCompleted) {
      await repos.tasks.delete(sibling.id);
    }
  }
}
