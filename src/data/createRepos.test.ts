import { describe, expect, it, vi } from "vitest";
import { createRepos } from "./createRepos";

vi.mock("./dataverse/generatedServices", async () => {
  const { createFakeDataverse } = await import("./dataverse/fakeDataverse");
  return { generatedServices: createFakeDataverse() };
});

describe("createRepos", () => {
  it("returns seeded in-memory repositories when VITE_USE_MOCKS is true", async () => {
    const repos = createRepos({ VITE_USE_MOCKS: "true" }, new Date(2026, 8, 17, 9));

    const lists = await repos.lists.getAll();

    expect(lists.find((list) => list.isInbox)?.name).toBe("Inbox");
  });

  it("returns Dataverse repositories over the generated services when mocks are off", async () => {
    const repos = createRepos({ VITE_USE_MOCKS: undefined });

    const created = await repos.lists.create({ name: "Inbox", isInbox: true });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repos.lists.getAll()).toEqual([created]);
  });
});
