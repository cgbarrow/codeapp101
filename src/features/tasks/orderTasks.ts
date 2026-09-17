import type { Task } from "@/data/repo";

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Date-only tasks fall due at the end of their day; timed tasks at their time. */
export function isOverdue(task: Task, now: Date) {
  if (task.isCompleted || task.dueDate === null) return false;
  const deadline = task.hasTime ? now : startOfDay(now);
  return task.dueDate.getTime() < deadline.getTime();
}

/** Open tasks: overdue first (earliest due first), then everything else by sort order. */
export function orderOpenTasks(tasks: readonly Task[], now: Date): Task[] {
  return tasks
    .filter((task) => !task.isCompleted)
    .sort((a, b) => {
      const aLate = isOverdue(a, now);
      const bLate = isOverdue(b, now);
      if (aLate !== bLate) return aLate ? -1 : 1;
      if (aLate) return a.dueDate!.getTime() - b.dueDate!.getTime() || a.sortOrder - b.sortOrder;
      return a.sortOrder - b.sortOrder;
    });
}

/** Completed tasks, most recently completed first; tasks with no completion time last. */
export function orderCompletedTasks(tasks: readonly Task[]): Task[] {
  const time = (task: Task) => task.completedOn?.getTime() ?? -Infinity;
  return tasks.filter((task) => task.isCompleted).sort((a, b) => time(b) - time(a));
}
