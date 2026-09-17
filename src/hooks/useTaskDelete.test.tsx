import { act, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos, Task } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { useTaskDelete } from "./useTaskDelete";

const now = new Date(2026, 8, 17, 9, 30);
let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
});

async function packTask(): Promise<Task> {
  return (await repos.tasks.getByList("seed-personal")).find((t) => t.id === "seed-t6")!;
}

describe("useTaskDelete", () => {
  it("fetches subtasks that are not cached, so Undo restores them", async () => {
    const user = userEvent.setup();
    const task = await packTask();
    const { result } = renderHook(() => useTaskDelete(), { wrapper: createWrapper(repos) });

    act(() => result.current(task));
    await waitFor(async () => expect(await packTask()).toBeUndefined());
    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(async () => {
      const restored = (await repos.tasks.getByList("seed-personal")).find(
        (t) => t.title === "Pack for the weekend",
      );
      expect(restored).toBeDefined();
      expect(await repos.subtasks.getByTask(restored!.id)).toHaveLength(3);
    });
  });

  it("does not delete when the subtasks cannot be read, and offers Retry", async () => {
    repos.subtasks.getByTask = async () => {
      throw new Error("offline");
    };
    const task = await packTask();
    const { result } = renderHook(() => useTaskDelete(), { wrapper: createWrapper(repos) });

    act(() => result.current(task));

    expect(await screen.findByText("Couldn't delete Pack for the weekend.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(await packTask()).toBeDefined();
  });
});
