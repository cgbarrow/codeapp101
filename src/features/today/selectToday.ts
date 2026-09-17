import type { List, Task } from "@/data/repo";
import { isOverdue, orderOpenTasks, startOfDay } from "@/features/tasks/orderTasks";

export type TodayGroup = { list: List; tasks: Task[] };
export type TodaySection = { title: "Overdue" | "Today"; groups: TodayGroup[] };

/**
 * The Today view: open tasks due by the end of today in the given lists, as an Overdue section and
 * a Today section, each grouped by list in sidebar order. Empty sections and groups are left out.
 */
export function selectToday(tasks: readonly Task[], lists: readonly List[], now: Date) {
  // The next local midnight, not start of day plus 24 hours: a DST change makes a day 23 or 25 hours.
  const today = startOfDay(now);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const due = orderOpenTasks(tasks, now).filter(
    (task) => task.dueDate !== null && task.dueDate < endOfToday,
  );
  const ordered = [...lists].sort((a, b) => a.sortOrder - b.sortOrder);

  const sections: TodaySection[] = [];
  for (const [title, overdue] of [
    ["Overdue", true],
    ["Today", false],
  ] as const) {
    const groups = ordered
      .map((list) => ({
        list,
        tasks: due.filter((task) => task.listId === list.id && isOverdue(task, now) === overdue),
      }))
      .filter((group) => group.tasks.length > 0);
    if (groups.length > 0) sections.push({ title, groups });
  }
  return sections;
}
