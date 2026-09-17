import { beforeEach, describe, expect, it } from "vitest";
import type { Repos } from "./repo";

/**
 * Behaviour every repository implementation must share. The mock repos run it in
 * repoContract.test.ts; the Dataverse repos run it in task 4. `makeRepos` must return
 * empty repositories.
 */
export function runRepoContract(name: string, makeRepos: () => Repos | Promise<Repos>) {
  describe(`${name} repository contract`, () => {
    let repos: Repos;

    beforeEach(async () => {
      repos = await makeRepos();
    });

    describe("lists", () => {
      it("creates a list with defaults and returns it with an id", async () => {
        const list = await repos.lists.create({ name: "Work" });

        expect(list).toEqual({
          id: expect.any(String),
          name: "Work",
          sortOrder: 0,
          isInbox: false,
          isArchived: false,
        });
      });

      it("returns every list ordered by sortOrder", async () => {
        await repos.lists.create({ name: "Second", sortOrder: 2 });
        await repos.lists.create({ name: "First", sortOrder: 1, isInbox: true });
        await repos.lists.create({ name: "Archived", sortOrder: 3, isArchived: true });

        const lists = await repos.lists.getAll();

        expect(lists.map((list) => list.name)).toEqual(["First", "Second", "Archived"]);
      });

      it("updates only the fields in the patch", async () => {
        const list = await repos.lists.create({ name: "Work", sortOrder: 4 });

        const updated = await repos.lists.update(list.id, { name: "Office" });

        expect(updated).toEqual({ ...list, name: "Office" });
        expect(await repos.lists.getAll()).toEqual([updated]);
      });

      it("deletes a list together with its tasks", async () => {
        const list = await repos.lists.create({ name: "Work" });
        const other = await repos.lists.create({ name: "Home" });
        await repos.tasks.create({ listId: list.id, title: "In deleted list" });
        const kept = await repos.tasks.create({ listId: other.id, title: "Kept" });

        await repos.lists.delete(list.id);

        expect(await repos.lists.getAll()).toEqual([other]);
        expect(await repos.tasks.getByList(list.id)).toEqual([]);
        expect(await repos.tasks.getByList(other.id)).toEqual([kept]);
      });

      it("rejects updating or deleting a list that does not exist", async () => {
        await expect(repos.lists.update("missing", { name: "x" })).rejects.toThrow();
        await expect(repos.lists.delete("missing")).rejects.toThrow();
      });
    });

    describe("tasks", () => {
      let listId: string;

      beforeEach(async () => {
        listId = (await repos.lists.create({ name: "Inbox", isInbox: true })).id;
      });

      it("creates a task with defaults", async () => {
        const task = await repos.tasks.create({ listId, title: "Buy milk" });

        expect(task).toEqual({
          id: expect.any(String),
          listId,
          title: "Buy milk",
          notes: "",
          dueDate: null,
          hasTime: false,
          reminderAt: null,
          isCompleted: false,
          completedOn: null,
          recurrence: "none",
          recurrenceParentId: null,
          sortOrder: 0,
        });
      });

      it("round-trips dates as Date instances at the same instant", async () => {
        const dueDate = new Date("2026-09-18T15:00:00.000Z");
        const reminderAt = new Date("2026-09-18T14:00:00.000Z");

        const created = await repos.tasks.create({
          listId,
          title: "Call Sam",
          dueDate,
          hasTime: true,
          reminderAt,
        });
        const [read] = await repos.tasks.getByList(listId);

        for (const task of [created, read]) {
          expect(task.dueDate).toBeInstanceOf(Date);
          expect(task.dueDate?.getTime()).toBe(dueDate.getTime());
          expect(task.reminderAt?.getTime()).toBe(reminderAt.getTime());
        }
      });

      it("returns only the tasks in the requested list, ordered by sortOrder", async () => {
        const otherListId = (await repos.lists.create({ name: "Work" })).id;
        await repos.tasks.create({ listId, title: "B", sortOrder: 2 });
        await repos.tasks.create({ listId, title: "A", sortOrder: 1, isCompleted: true });
        await repos.tasks.create({ listId: otherListId, title: "Elsewhere" });

        const tasks = await repos.tasks.getByList(listId);

        expect(tasks.map((task) => task.title)).toEqual(["A", "B"]);
      });

      it("returns open tasks due before a moment across lists, earliest first", async () => {
        const otherListId = (await repos.lists.create({ name: "Work" })).id;
        const end = new Date("2026-09-18T00:00:00.000Z");
        await repos.tasks.create({
          listId,
          title: "Due today",
          dueDate: new Date("2026-09-17T09:00:00Z"),
        });
        await repos.tasks.create({
          listId: otherListId,
          title: "Overdue",
          dueDate: new Date("2026-09-10T09:00:00Z"),
        });
        await repos.tasks.create({ listId, title: "Tomorrow", dueDate: end });
        await repos.tasks.create({ listId, title: "No date" });
        await repos.tasks.create({
          listId,
          title: "Done",
          dueDate: new Date("2026-09-16T09:00:00Z"),
          isCompleted: true,
        });

        const tasks = await repos.tasks.getOpenDueBefore(end);

        expect(tasks.map((task) => task.title)).toEqual(["Overdue", "Due today"]);
      });

      it("updates only the fields in the patch, including clearing a date", async () => {
        const task = await repos.tasks.create({
          listId,
          title: "Buy milk",
          notes: "Oat",
          dueDate: new Date("2026-09-18T00:00:00Z"),
        });
        const completedOn = new Date("2026-09-17T10:00:00Z");

        const updated = await repos.tasks.update(task.id, {
          isCompleted: true,
          completedOn,
          dueDate: null,
        });

        expect(updated).toEqual({ ...task, isCompleted: true, completedOn, dueDate: null });
        expect(await repos.tasks.getByList(listId)).toEqual([updated]);
      });

      it("moves a task to another list", async () => {
        const otherListId = (await repos.lists.create({ name: "Work" })).id;
        const task = await repos.tasks.create({ listId, title: "Move me" });

        await repos.tasks.update(task.id, { listId: otherListId });

        expect(await repos.tasks.getByList(listId)).toEqual([]);
        expect((await repos.tasks.getByList(otherListId)).map((t) => t.id)).toEqual([task.id]);
      });

      it("deletes a task together with its subtasks", async () => {
        const task = await repos.tasks.create({ listId, title: "Pack" });
        await repos.subtasks.create({ taskId: task.id, title: "Socks" });

        await repos.tasks.delete(task.id);

        expect(await repos.tasks.getByList(listId)).toEqual([]);
        expect(await repos.subtasks.getByTask(task.id)).toEqual([]);
      });

      it("links a recurring instance to its parent", async () => {
        const parent = await repos.tasks.create({
          listId,
          title: "Water plants",
          recurrence: "weekly",
        });

        const next = await repos.tasks.create({
          listId,
          title: "Water plants",
          recurrence: "weekly",
          recurrenceParentId: parent.id,
        });

        expect(next.recurrenceParentId).toBe(parent.id);
      });

      it("rejects updating or deleting a task that does not exist", async () => {
        await expect(repos.tasks.update("missing", { title: "x" })).rejects.toThrow();
        await expect(repos.tasks.delete("missing")).rejects.toThrow();
      });
    });

    describe("subtasks", () => {
      let taskId: string;

      beforeEach(async () => {
        const list = await repos.lists.create({ name: "Inbox" });
        taskId = (await repos.tasks.create({ listId: list.id, title: "Pack" })).id;
      });

      it("creates a subtask with defaults", async () => {
        const subtask = await repos.subtasks.create({ taskId, title: "Socks" });

        expect(subtask).toEqual({
          id: expect.any(String),
          taskId,
          title: "Socks",
          isDone: false,
          sortOrder: 0,
        });
      });

      it("returns a task's subtasks ordered by sortOrder", async () => {
        const otherTask = await repos.tasks.create({
          listId: (await repos.lists.getAll())[0].id,
          title: "Other",
        });
        await repos.subtasks.create({ taskId, title: "Second", sortOrder: 2 });
        await repos.subtasks.create({ taskId, title: "First", sortOrder: 1 });
        await repos.subtasks.create({ taskId: otherTask.id, title: "Elsewhere" });

        const subtasks = await repos.subtasks.getByTask(taskId);

        expect(subtasks.map((subtask) => subtask.title)).toEqual(["First", "Second"]);
      });

      it("updates and deletes a subtask", async () => {
        const subtask = await repos.subtasks.create({ taskId, title: "Socks" });

        const updated = await repos.subtasks.update(subtask.id, { isDone: true });
        expect(updated).toEqual({ ...subtask, isDone: true });

        await repos.subtasks.delete(subtask.id);
        expect(await repos.subtasks.getByTask(taskId)).toEqual([]);
      });

      it("rejects updating or deleting a subtask that does not exist", async () => {
        await expect(repos.subtasks.update("missing", { title: "x" })).rejects.toThrow();
        await expect(repos.subtasks.delete("missing")).rejects.toThrow();
      });
    });
  });
}
