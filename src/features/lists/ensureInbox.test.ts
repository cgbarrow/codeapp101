import { describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { ensureInbox } from "./ensureInbox";

describe("ensureInbox", () => {
  it("creates an Inbox when the user has no lists", async () => {
    const { lists } = createMockRepos();

    const inbox = await ensureInbox(lists);

    expect(inbox).toMatchObject({ name: "Inbox", isInbox: true, sortOrder: 0 });
    expect(await lists.getAll()).toEqual([inbox]);
  });

  it("returns the existing Inbox without creating another", async () => {
    const { lists } = createMockRepos({
      seed: {
        lists: [{ id: "in", name: "Inbox", sortOrder: 3, isInbox: true, isArchived: false }],
      },
    });

    const inbox = await ensureInbox(lists);

    expect(inbox.id).toBe("in");
    expect(await lists.getAll()).toHaveLength(1);
  });

  it("creates an Inbox ahead of existing lists when none of them is the Inbox", async () => {
    const { lists } = createMockRepos({
      seed: {
        lists: [{ id: "w", name: "Work", sortOrder: 0, isInbox: false, isArchived: false }],
      },
    });

    const inbox = await ensureInbox(lists);

    expect(inbox.sortOrder).toBe(-1);
    expect((await lists.getAll()).map((list) => list.name)).toEqual(["Inbox", "Work"]);
  });

  it("creates the Inbox exactly once when called twice at the same time", async () => {
    const { lists } = createMockRepos({ latencyMs: 5 });

    const [first, second] = await Promise.all([ensureInbox(lists), ensureInbox(lists)]);

    expect(first.id).toBe(second.id);
    expect(await lists.getAll()).toHaveLength(1);
  });

  it("tries again on a later call if the first attempt failed", async () => {
    const repos = createMockRepos();
    const create = repos.lists.create;
    repos.lists.create = async () => {
      throw new Error("Network down");
    };

    await expect(ensureInbox(repos.lists)).rejects.toThrow("Network down");
    repos.lists.create = create;

    await expect(ensureInbox(repos.lists)).resolves.toMatchObject({ isInbox: true });
  });
});
