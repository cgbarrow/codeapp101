import { describe, expect, it } from "vitest";
import { createRepos } from "./createRepos";

describe("createRepos", () => {
  it("returns seeded in-memory repositories when VITE_USE_MOCKS is true", async () => {
    const repos = createRepos({ VITE_USE_MOCKS: "true" }, new Date(2026, 8, 17, 9));

    const lists = await repos.lists.getAll();

    expect(lists.find((list) => list.isInbox)?.name).toBe("Inbox");
  });

  it("refuses to fall back to fake data when mocks are off", () => {
    expect(() => createRepos({ VITE_USE_MOCKS: undefined })).toThrow(/Dataverse/);
  });
});
