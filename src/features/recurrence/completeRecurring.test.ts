import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import type { Repos, Task } from "@/data/repo";
import { buildNextInstance, createNextInstance, removeNextInstance } from "./completeRecurring";

let repos: Repos;
let listId: string;

beforeEach(async () => {
  repos = createMockRepos();
  listId = (await repos.lists.create({ name: "Home" })).id;
});

const now = new Date(2026, 8, 17, 9, 30);

async function weeklyTask(fields: Partial<Task> = {}) {
  return repos.tasks.create({
    listId,
    title: "Water the plants",
    notes: "Both balconies",
    dueDate: new Date(2026, 8, 17, 18, 0),
    hasTime: true,
    reminderAt: new Date(2026, 8, 17, 17, 0),
    recurrence: "weekly",
    sortOrder: 4,
    ...fields,
  });
}

const openInstances = async (parent: Task) =>
  (await repos.tasks.getByList(listId)).filter(
    (task) => task.recurrenceParentId === parent.id && !task.isCompleted,
  );

describe("buildNextInstance", () => {
  it("copies the task into the next slot, open, linked to the completed instance", async () => {
    const task = await weeklyTask();

    expect(buildNextInstance(task, () => undefined, now)).toEqual({
      listId,
      title: "Water the plants",
      notes: "Both balconies",
      dueDate: new Date(2026, 8, 24, 18, 0),
      hasTime: true,
      reminderAt: new Date(2026, 8, 24, 17, 0),
      recurrence: "weekly",
      recurrenceParentId: task.id,
      sortOrder: 4,
      isCompleted: false,
      completedOn: null,
    });
  });

  it("returns null for a task that does not repeat", async () => {
    const task = await weeklyTask({ recurrence: "none" });

    expect(buildNextInstance(task, () => undefined, now)).toBeNull();
  });

  it("keeps a custom reminder the same distance before the due date", async () => {
    const task = await weeklyTask({ reminderAt: new Date(2026, 8, 15, 12, 0) });

    expect(buildNextInstance(task, () => undefined, now)?.reminderAt).toEqual(
      new Date(2026, 8, 22, 12, 0),
    );
  });

  it("keeps a preset reminder on the clock across a DST change", async () => {
    const task = await weeklyTask({
      // Clocks go back overnight, so this "1 day before" reminder is 25 hours before the task.
      dueDate: new Date(2026, 10, 1, 9, 0),
      reminderAt: new Date(2026, 9, 31, 9, 0),
    });

    expect(buildNextInstance(task, () => undefined, now)?.reminderAt).toEqual(
      new Date(2026, 10, 7, 9, 0),
    );
  });

  it("returns to the anchor day of a monthly chain", async () => {
    const jan = await weeklyTask({
      recurrence: "monthly",
      dueDate: new Date(2026, 0, 31),
      hasTime: false,
      reminderAt: null,
    });
    const feb = await weeklyTask({
      recurrence: "monthly",
      dueDate: new Date(2026, 1, 28),
      hasTime: false,
      reminderAt: null,
      recurrenceParentId: jan.id,
    });

    const find = (id: string) => [jan, feb].find((t) => t.id === id);
    expect(buildNextInstance(feb, find, now)?.dueDate).toEqual(new Date(2026, 2, 31));
  });

  it("repeats from today when a repeating task has no due date", async () => {
    const task = await weeklyTask({ dueDate: null, hasTime: false, reminderAt: null });

    expect(buildNextInstance(task, () => undefined, now)?.dueDate).toEqual(new Date(2026, 8, 24));
  });
});

describe("createNextInstance", () => {
  it("creates the next instance with the subtasks copied unticked", async () => {
    const task = await weeklyTask();
    await repos.subtasks.create({ taskId: task.id, title: "Fill can", isDone: true, sortOrder: 0 });
    await repos.subtasks.create({ taskId: task.id, title: "Feed", isDone: false, sortOrder: 1 });

    const next = await createNextInstance(repos, task, now);

    expect(next).toMatchObject({
      dueDate: new Date(2026, 8, 24, 18, 0),
      recurrenceParentId: task.id,
    });
    const subtasks = await repos.subtasks.getByTask(next!.id);
    expect(subtasks.map(({ title, isDone, sortOrder }) => ({ title, isDone, sortOrder }))).toEqual([
      { title: "Fill can", isDone: false, sortOrder: 0 },
      { title: "Feed", isDone: false, sortOrder: 1 },
    ]);
  });

  it("creates nothing when the task already has a next instance", async () => {
    const task = await weeklyTask();

    await createNextInstance(repos, task, now);
    const again = await createNextInstance(repos, task, now);

    expect(again).toBeNull();
    expect(await openInstances(task)).toHaveLength(1);
  });

  it("creates nothing for a task that does not repeat", async () => {
    const task = await weeklyTask({ recurrence: "none" });

    expect(await createNextInstance(repos, task, now)).toBeNull();
    expect(await repos.tasks.getByList(listId)).toHaveLength(1);
  });
});

describe("removeNextInstance", () => {
  it("deletes the open instance created from the task, with its subtasks", async () => {
    const task = await weeklyTask();
    await repos.subtasks.create({ taskId: task.id, title: "Fill can" });
    const next = (await createNextInstance(repos, task, now))!;

    await removeNextInstance(repos, task);

    expect(await openInstances(task)).toEqual([]);
    expect(await repos.subtasks.getByTask(next.id)).toEqual([]);
    expect((await repos.tasks.getByList(listId)).map((t) => t.id)).toEqual([task.id]);
  });

  it("leaves an instance that has already been completed", async () => {
    const task = await weeklyTask();
    const next = (await createNextInstance(repos, task, now))!;
    await repos.tasks.update(next.id, { isCompleted: true, completedOn: now });

    await removeNextInstance(repos, task);

    expect((await repos.tasks.getByList(listId)).map((t) => t.id)).toContain(next.id);
  });
});
