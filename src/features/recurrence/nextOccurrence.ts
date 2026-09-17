import type { Recurrence, Task } from "@/data/repo";

const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/**
 * The due date after `dueDate` for a repeating task, or `null` if it does not repeat. Dates are
 * built from local calendar fields, never by adding milliseconds, so the clock time survives DST.
 * Monthly repeats land on `anchorDay`, clamped to the end of shorter months.
 */
export function nextOccurrence(
  dueDate: Date,
  recurrence: Recurrence,
  anchorDay = dueDate.getDate(),
): Date | null {
  const year = dueDate.getFullYear();
  const month = dueDate.getMonth();
  const day = dueDate.getDate();
  const at = (y: number, m: number, d: number) =>
    new Date(y, m, d, dueDate.getHours(), dueDate.getMinutes(), dueDate.getSeconds());

  switch (recurrence) {
    case "none":
      return null;
    case "daily":
      return at(year, month, day + 1);
    case "weekly":
      return at(year, month, day + 7);
    case "monthly": {
      const target = new Date(year, month + 1, 1);
      const targetYear = target.getFullYear();
      const targetMonth = target.getMonth();
      return at(targetYear, targetMonth, Math.min(anchorDay, daysInMonth(targetYear, targetMonth)));
    }
  }
}

type ChainLink = Pick<Task, "id" | "dueDate" | "recurrenceParentId">;

/**
 * The day of the month a monthly chain is aiming for. A date on the last day of a month may have
 * been clamped, as 28 February is from 31 January, so the previous instances decide. Any other
 * date, including one the user moved, is its own anchor.
 */
export function anchorDayOf(
  task: ChainLink,
  findTask: (id: string) => ChainLink | undefined,
  seen = new Set<string>(),
): number | undefined {
  if (!task.dueDate) return undefined;
  const day = task.dueDate.getDate();
  const lastDay = daysInMonth(task.dueDate.getFullYear(), task.dueDate.getMonth());
  if (day !== lastDay || !task.recurrenceParentId || seen.has(task.id)) return day;

  const parent = findTask(task.recurrenceParentId);
  if (!parent) return day;
  const parentAnchor = anchorDayOf(parent, findTask, seen.add(task.id));
  return parentAnchor !== undefined && Math.min(parentAnchor, lastDay) === day ? parentAnchor : day;
}
