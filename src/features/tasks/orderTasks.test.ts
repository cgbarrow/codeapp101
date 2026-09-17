import { describe, expect, it } from "vitest";
import { taskDefaults } from "@/data/defaults";
import type { Task } from "@/data/repo";
import { isOverdue, orderCompletedTasks, orderOpenTasks } from "./orderTasks";

const now = new Date(2026, 8, 17, 9, 30);

function task(id: string, fields: Partial<Task> = {}): Task {
  return { ...taskDefaults, id, listId: "l", title: id, ...fields };
}

describe("isOverdue", () => {
  it("treats a date-only task as overdue from the day after its due date", () => {
    expect(isOverdue(task("a", { dueDate: new Date(2026, 8, 16) }), now)).toBe(true);
    expect(isOverdue(task("b", { dueDate: new Date(2026, 8, 17) }), now)).toBe(false);
  });

  it("treats a timed task as overdue once its time has passed", () => {
    const at = (h: number, m: number) => new Date(2026, 8, 17, h, m);
    expect(isOverdue(task("a", { dueDate: at(9, 0), hasTime: true }), now)).toBe(true);
    expect(isOverdue(task("b", { dueDate: at(10, 0), hasTime: true }), now)).toBe(false);
  });

  it("never marks a completed task or one without a date as overdue", () => {
    const yesterday = new Date(2026, 8, 16);
    expect(isOverdue(task("a", { dueDate: yesterday, isCompleted: true }), now)).toBe(false);
    expect(isOverdue(task("b"), now)).toBe(false);
  });
});

describe("orderOpenTasks", () => {
  it("puts overdue tasks first, earliest due, then the rest by sort order", () => {
    const tasks = [
      task("plain-2", { sortOrder: 2 }),
      task("late-recent", { sortOrder: 0, dueDate: new Date(2026, 8, 15) }),
      task("plain-1", { sortOrder: 1, dueDate: new Date(2026, 8, 20) }),
      task("late-oldest", { sortOrder: 3, dueDate: new Date(2026, 8, 1) }),
      task("done", { sortOrder: -1, isCompleted: true }),
    ];

    expect(orderOpenTasks(tasks, now).map((t) => t.id)).toEqual([
      "late-oldest",
      "late-recent",
      "plain-1",
      "plain-2",
    ]);
  });
});

describe("orderCompletedTasks", () => {
  it("lists completed tasks most recently completed first", () => {
    const tasks = [
      task("old", { isCompleted: true, completedOn: new Date(2026, 8, 1) }),
      task("open"),
      task("new", { isCompleted: true, completedOn: new Date(2026, 8, 16) }),
      task("unknown", { isCompleted: true, completedOn: null }),
    ];

    expect(orderCompletedTasks(tasks).map((t) => t.id)).toEqual(["new", "old", "unknown"]);
  });
});
