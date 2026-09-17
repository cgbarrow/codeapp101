import { describe, expect, it } from "vitest";
import { listDefaults, taskDefaults } from "@/data/defaults";
import type { List, Task } from "@/data/repo";
import { selectToday } from "./selectToday";

// Tests run in America/Toronto (vitest.config.ts). In 2026 clocks go forward on 8 March, making
// that day 23 hours long, and back on 1 November, making that day 25 hours long.

const work: List = { ...listDefaults, id: "work", name: "Work", sortOrder: 1 };
const home: List = { ...listDefaults, id: "home", name: "Home", sortOrder: 0 };

function task(id: string, fields: Partial<Task> = {}): Task {
  return { ...taskDefaults, id, listId: "work", title: id, ...fields };
}

/** Task ids by section, then by list: `{ Overdue: { Work: ["a"] } }`. */
function shape(sections: ReturnType<typeof selectToday>) {
  return Object.fromEntries(
    sections.map((section) => [
      section.title,
      Object.fromEntries(
        section.groups.map((group) => [group.list.name, group.tasks.map((t) => t.id)]),
      ),
    ]),
  );
}

describe("selectToday", () => {
  const now = new Date(2026, 8, 17, 9, 30);

  it("keeps open tasks due today or earlier, grouped Overdue then Today, then by list order", () => {
    const tasks = [
      task("work-today", { dueDate: new Date(2026, 8, 17) }),
      task("home-today", { listId: "home", dueDate: new Date(2026, 8, 17) }),
      task("work-late", { dueDate: new Date(2026, 8, 15) }),
      task("tomorrow", { dueDate: new Date(2026, 8, 18) }),
      task("undated"),
      task("done", { dueDate: new Date(2026, 8, 17), isCompleted: true }),
    ];

    expect(shape(selectToday(tasks, [work, home], now))).toEqual({
      Overdue: { Work: ["work-late"] },
      Today: { Home: ["home-today"], Work: ["work-today"] },
    });
  });

  it("orders overdue tasks earliest due first and today's tasks by sort order", () => {
    const tasks = [
      task("late-recent", { dueDate: new Date(2026, 8, 16), sortOrder: 0 }),
      task("late-oldest", { dueDate: new Date(2026, 8, 1), sortOrder: 1 }),
      task("today-second", { dueDate: new Date(2026, 8, 17), sortOrder: 5 }),
      task("today-first", { dueDate: new Date(2026, 8, 17, 18, 0), hasTime: true, sortOrder: 2 }),
    ];

    expect(shape(selectToday(tasks, [work], now))).toEqual({
      Overdue: { Work: ["late-oldest", "late-recent"] },
      Today: { Work: ["today-first", "today-second"] },
    });
  });

  it("counts a timed task whose time has passed today as overdue", () => {
    const tasks = [task("earlier", { dueDate: new Date(2026, 8, 17, 9, 0), hasTime: true })];

    expect(shape(selectToday(tasks, [work], now))).toEqual({ Overdue: { Work: ["earlier"] } });
  });

  it("leaves out tasks from lists it was not given, such as archived lists", () => {
    const tasks = [task("hidden", { listId: "archived", dueDate: new Date(2026, 8, 17) })];

    expect(selectToday(tasks, [work], now)).toEqual([]);
  });

  it("moves the day on at midnight", () => {
    const tasks = [
      task("17th", { dueDate: new Date(2026, 8, 17) }),
      task("18th", { dueDate: new Date(2026, 8, 18) }),
    ];

    expect(shape(selectToday(tasks, [work], new Date(2026, 8, 17, 23, 59, 59)))).toEqual({
      Today: { Work: ["17th"] },
    });
    expect(shape(selectToday(tasks, [work], new Date(2026, 8, 18, 0, 0, 0)))).toEqual({
      Overdue: { Work: ["17th"] },
      Today: { Work: ["18th"] },
    });
  });

  it("ends a 23-hour day at local midnight when clocks go forward", () => {
    const tasks = [
      task("8th-late", { dueDate: new Date(2026, 2, 8, 23, 45), hasTime: true }),
      task("9th", { dueDate: new Date(2026, 2, 9) }),
    ];

    expect(shape(selectToday(tasks, [work], new Date(2026, 2, 8, 23, 30)))).toEqual({
      Today: { Work: ["8th-late"] },
    });
  });

  it("ends a 25-hour day at local midnight when clocks go back", () => {
    const tasks = [
      task("1st-late", { dueDate: new Date(2026, 10, 1, 23, 45), hasTime: true }),
      task("2nd", { dueDate: new Date(2026, 10, 2) }),
    ];

    expect(shape(selectToday(tasks, [work], new Date(2026, 10, 1, 23, 30)))).toEqual({
      Today: { Work: ["1st-late"] },
    });
  });
});
