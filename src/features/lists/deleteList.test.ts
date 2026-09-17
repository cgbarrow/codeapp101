import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { deleteList } from "./deleteList";

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(new Date(2026, 8, 17, 9, 30)) });
});

describe("deleteList", () => {
  it("deletes the list and its tasks when asked to", async () => {
    await deleteList(repos, "seed-work", { moveTasksTo: null });

    expect((await repos.lists.getAll()).map((list) => list.id)).not.toContain("seed-work");
    expect(await repos.tasks.getByList("seed-work")).toEqual([]);
    expect(await repos.tasks.getByList("seed-inbox")).toHaveLength(1);
  });

  it("moves every task, completed or not, to the target list before deleting", async () => {
    await deleteList(repos, "seed-work", { moveTasksTo: "seed-inbox" });

    const inbox = await repos.tasks.getByList("seed-inbox");
    expect(inbox.map((task) => task.title)).toEqual([
      "Reply to the landlord",
      "Send the Q3 budget draft",
      "Call Sam about the offsite",
      "Review the pull request",
    ]);
    expect(inbox.map((task) => task.sortOrder)).toEqual([0, 1, 2, 3]);
    expect((await repos.lists.getAll()).map((list) => list.id)).not.toContain("seed-work");
  });

  it("keeps the list if moving a task fails", async () => {
    repos.tasks.update = async () => {
      throw new Error("Network down");
    };

    await expect(deleteList(repos, "seed-work", { moveTasksTo: "seed-inbox" })).rejects.toThrow(
      "Network down",
    );
    expect((await repos.lists.getAll()).map((list) => list.id)).toContain("seed-work");
  });

  it("refuses to delete the Inbox", async () => {
    await expect(deleteList(repos, "seed-inbox", { moveTasksTo: null })).rejects.toThrow(
      "The Inbox cannot be deleted",
    );
    expect((await repos.lists.getAll()).map((list) => list.id)).toContain("seed-inbox");
  });

  it("refuses to move tasks into the list being deleted", async () => {
    await expect(deleteList(repos, "seed-work", { moveTasksTo: "seed-work" })).rejects.toThrow();
    expect(await repos.tasks.getByList("seed-work")).toHaveLength(3);
  });
});
