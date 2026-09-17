import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockRepos, NotFoundError } from "./mockRepos";
import { createSampleSeed } from "./seed";

describe("createMockRepos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns copies, so changing a returned task does not change the store", async () => {
    const repos = createMockRepos();
    const list = await repos.lists.create({ name: "Inbox" });
    const task = await repos.tasks.create({
      listId: list.id,
      title: "Original",
      dueDate: new Date("2026-09-18T00:00:00Z"),
    });

    task.title = "Mutated";
    task.dueDate!.setFullYear(2000);

    const [stored] = await repos.tasks.getByList(list.id);
    expect(stored.title).toBe("Original");
    expect(stored.dueDate?.getFullYear()).toBe(2026);
  });

  it("does not let the caller's seed objects alias the store", async () => {
    const seed = createSampleSeed(new Date(2026, 8, 17, 9));
    const repos = createMockRepos({ seed });

    seed.lists![0].name = "Changed after seeding";

    expect((await repos.lists.getAll())[0].name).not.toBe("Changed after seeding");
  });

  it("ignores undefined fields in a patch", async () => {
    const repos = createMockRepos();
    const list = await repos.lists.create({ name: "Work" });

    const updated = await repos.lists.update(list.id, { name: undefined, sortOrder: 3 });

    expect(updated.name).toBe("Work");
  });

  it("rejects with NotFoundError for unknown ids", async () => {
    const repos = createMockRepos();

    await expect(repos.tasks.update("nope", { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("waits for the configured latency before resolving", async () => {
    vi.useFakeTimers();
    const repos = createMockRepos({ latencyMs: 300 });
    let resolved = false;

    const pending = repos.lists.getAll().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await pending;

    expect(resolved).toBe(true);
  });
});

describe("createSampleSeed", () => {
  const now = new Date(2026, 8, 17, 9, 30);

  it("is deterministic for the same moment", () => {
    expect(createSampleSeed(now)).toEqual(createSampleSeed(now));
  });

  it("has exactly one Inbox and every task points at a real list", () => {
    const seed = createSampleSeed(now);
    const listIds = new Set(seed.lists!.map((list) => list.id));

    expect(seed.lists!.filter((list) => list.isInbox)).toHaveLength(1);
    expect(seed.tasks!.every((task) => listIds.has(task.listId))).toBe(true);
  });

  it("covers the states the UI needs: overdue, due today, undated, completed, recurring, subtasks", async () => {
    const repos = createMockRepos({ seed: createSampleSeed(now) });
    const startOfTomorrow = new Date(2026, 8, 18);
    const seed = createSampleSeed(now);

    const dueBeforeTomorrow = await repos.tasks.getOpenDueBefore(startOfTomorrow);
    const startOfToday = new Date(2026, 8, 17);

    expect(dueBeforeTomorrow.some((task) => task.dueDate! < startOfToday)).toBe(true);
    expect(dueBeforeTomorrow.some((task) => task.dueDate! >= startOfToday)).toBe(true);
    expect(seed.tasks!.some((task) => task.dueDate === null)).toBe(true);
    expect(seed.tasks!.some((task) => task.isCompleted)).toBe(true);
    expect(seed.tasks!.some((task) => task.recurrence !== "none")).toBe(true);
    expect(seed.subtasks!.length).toBeGreaterThan(0);
  });
});
