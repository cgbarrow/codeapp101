import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { createTestQueryClient, createWrapper, deferred } from "@/test/renderWithProviders";
import { createMockRepos } from "./mock/mockRepos";
import { createSampleSeed } from "./mock/seed";
import {
  useCreateList,
  useCreateTask,
  useDeleteList,
  useDeleteTask,
  useInbox,
  useCompletedTasks,
  useLists,
  useTaskCounts,
  useReorderLists,
  useTasks,
  useTodayTasks,
  useToggleTask,
  useUpdateList,
  useUpdateTask,
} from "./queries";
import type { Repos, Task } from "./repo";

const now = new Date(2026, 8, 17, 9, 30);

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
});

function renderWithRepos<T>(hook: () => T) {
  const queryClient = createTestQueryClient();
  return { ...renderHook(hook, { wrapper: createWrapper(repos, queryClient) }), queryClient };
}

describe("useLists", () => {
  it("loads every list in order", async () => {
    const { result } = renderWithRepos(() => useLists());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((list) => list.name)).toEqual([
      "Inbox",
      "Work",
      "Personal",
      "Groceries",
    ]);
  });
});

describe("useTasks", () => {
  it("loads the tasks of one list", async () => {
    const { result } = renderWithRepos(() => useTasks("seed-work"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.every((task) => task.listId === "seed-work")).toBe(true);
    expect(result.current.data).toHaveLength(3);
  });
});

describe("useTodayTasks", () => {
  it("loads open tasks due before tomorrow across all lists", async () => {
    const { result } = renderWithRepos(() => useTodayTasks(now));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((task) => task.title)).toEqual([
      "Send the Q3 budget draft",
      "Water the plants",
      "Call Sam about the offsite",
    ]);
  });
});

describe("useToggleTask", () => {
  it("shows the new state immediately, before the repository answers", async () => {
    const gate = deferred();
    const update = repos.tasks.update;
    repos.tasks.update = async (id, patch) => {
      await gate.promise;
      return update(id, patch);
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-work"),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: true }));

    await waitFor(() => {
      const task = result.current.tasks.data?.find((t) => t.id === "seed-t2");
      expect(task?.isCompleted).toBe(true);
      expect(task?.completedOn).toBeInstanceOf(Date);
    });
    expect(result.current.toggle.isPending).toBe(true);

    gate.resolve();
    await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));
    const [stored] = (await repos.tasks.getByList("seed-work")).filter((t) => t.id === "seed-t2");
    expect(stored.isCompleted).toBe(true);
  });

  it("rolls back to the previous state when the repository rejects", async () => {
    const gate = deferred();
    repos.tasks.update = async () => {
      await gate.promise;
      throw new Error("unreachable");
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-work"),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: true }));
    await waitFor(() =>
      expect(result.current.tasks.data?.find((t) => t.id === "seed-t2")?.isCompleted).toBe(true),
    );
    gate.reject(new Error("Network down"));

    await waitFor(() => expect(result.current.toggle.isError).toBe(true));
    const task = result.current.tasks.data?.find((t) => t.id === "seed-t2");
    expect(task?.isCompleted).toBe(false);
    expect(task?.completedOn).toBeNull();
  });

  it("clears completedOn when a task is marked incomplete", async () => {
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-work"),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t4", isCompleted: false }));

    await waitFor(() => expect(result.current.toggle.isSuccess).toBe(true));
    const task = (await repos.tasks.getByList("seed-work")).find((t) => t.id === "seed-t4");
    expect(task?.isCompleted).toBe(false);
    expect(task?.completedOn).toBeNull();
  });

  it("updates the Today cache optimistically as well", async () => {
    const gate = deferred();
    const update = repos.tasks.update;
    repos.tasks.update = async (id, patch) => {
      await gate.promise;
      return update(id, patch);
    };
    const { result } = renderWithRepos(() => ({
      today: useTodayTasks(now),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.today.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t5", isCompleted: true }));

    await waitFor(() =>
      expect(result.current.today.data?.find((t) => t.id === "seed-t5")?.isCompleted).toBe(true),
    );
    gate.resolve();
  });

  it("sends toggle writes one at a time, in the order they were made", async () => {
    const gates = [deferred(), deferred()];
    const calls: boolean[] = [];
    const update = repos.tasks.update;
    repos.tasks.update = async (id, patch) => {
      const gate = gates[calls.length];
      calls.push(patch.isCompleted!);
      await gate.promise;
      return update(id, patch);
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-work"),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: true }));
    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: false }));
    await waitFor(() => expect(calls).toEqual([true]));

    gates[0].resolve();
    await waitFor(() => expect(calls).toEqual([true, false]));
    gates[1].resolve();

    await waitFor(async () => {
      const [stored] = (await repos.tasks.getByList("seed-work")).filter((t) => t.id === "seed-t2");
      expect(stored.isCompleted).toBe(false);
    });
  });

  it("never shows an undone completion again while the earlier write settles", async () => {
    const gates = [deferred(), deferred()];
    let call = 0;
    const update = repos.tasks.update;
    repos.tasks.update = async (id, patch) => {
      await gates[call++].promise;
      return update(id, patch);
    };
    const { result, queryClient } = renderWithRepos(() => ({
      tasks: useTasks("seed-work"),
      toggle: useToggleTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: true }));
    act(() => result.current.toggle.mutate({ id: "seed-t2", isCompleted: false }));
    await waitFor(() =>
      expect(result.current.tasks.data?.find((t) => t.id === "seed-t2")?.isCompleted).toBe(false),
    );
    const seen: boolean[] = [];
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      const data = queryClient.getQueryData<Task[]>(["tasks", "list", "seed-work"]);
      const task = data?.find((t) => t.id === "seed-t2");
      if (task) seen.push(task.isCompleted);
    });

    gates[0].resolve();
    await waitFor(() => expect(call).toBe(2));
    gates[1].resolve();
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    unsubscribe();

    expect(seen).not.toContain(true);
    expect(result.current.tasks.data?.find((t) => t.id === "seed-t2")?.isCompleted).toBe(false);
  });
});

describe("useCreateTask", () => {
  it("inserts a placeholder row immediately, then replaces it with the saved task", async () => {
    const gate = deferred();
    const create = repos.tasks.create;
    repos.tasks.create = async (input) => {
      await gate.promise;
      return create(input);
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-groceries"),
      create: useCreateTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.create.mutate({ listId: "seed-groceries", title: "Buy eggs" }));

    await waitFor(() => {
      const row = result.current.tasks.data?.find((t) => t.title === "Buy eggs");
      expect(row?.id).toMatch(/^optimistic-/);
    });

    gate.resolve();
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    await waitFor(() => {
      const row = result.current.tasks.data?.find((t) => t.title === "Buy eggs");
      expect(row?.id).toBe(result.current.create.data?.id);
    });
  });

  it("removes the placeholder row when the create fails", async () => {
    repos.tasks.create = async () => {
      throw new Error("Network down");
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-groceries"),
      create: useCreateTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.create.mutate({ listId: "seed-groceries", title: "Buy eggs" }));

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(result.current.tasks.data?.some((t) => t.title === "Buy eggs")).toBe(false);
  });
});

describe("useUpdateTask", () => {
  it("sends only the patch and keeps the change after refetch", async () => {
    const patches: unknown[] = [];
    const update = repos.tasks.update;
    repos.tasks.update = (id, patch) => {
      patches.push(patch);
      return update(id, patch);
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-personal"),
      update: useUpdateTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.update.mutate({ id: "seed-t6", patch: { title: "Pack the bag" } }));

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    await waitFor(() =>
      expect(result.current.tasks.data?.find((t) => t.id === "seed-t6")?.title).toBe(
        "Pack the bag",
      ),
    );
    expect(patches).toEqual([{ title: "Pack the bag" }]);
  });

  it("rolls back the edit when the repository rejects", async () => {
    repos.tasks.update = async () => {
      throw new Error("Network down");
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-personal"),
      update: useUpdateTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.update.mutate({ id: "seed-t6", patch: { title: "Pack the bag" } }));

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(result.current.tasks.data?.find((t) => t.id === "seed-t6")?.title).toBe(
      "Pack for the weekend",
    );
  });

  it("moves a task between list caches when its list changes", async () => {
    const { result } = renderWithRepos(() => ({
      from: useTasks("seed-groceries"),
      to: useTasks("seed-inbox"),
      update: useUpdateTask(),
    }));
    await waitFor(() =>
      expect(result.current.from.isSuccess && result.current.to.isSuccess).toBe(true),
    );

    act(() => result.current.update.mutate({ id: "seed-t7", patch: { listId: "seed-inbox" } }));

    await waitFor(() => {
      expect(result.current.from.data?.some((t) => t.id === "seed-t7")).toBe(false);
      expect(result.current.to.data?.some((t) => t.id === "seed-t7")).toBe(true);
    });
  });
});

describe("useDeleteTask", () => {
  it("removes the row immediately and restores it if the delete fails", async () => {
    const gate = deferred();
    repos.tasks.delete = async () => {
      await gate.promise;
      throw new Error("unreachable");
    };
    const { result } = renderWithRepos(() => ({
      tasks: useTasks("seed-groceries"),
      remove: useDeleteTask(),
    }));
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));

    act(() => result.current.remove.mutate("seed-t7"));
    await waitFor(() => expect(result.current.tasks.data).toEqual([]));
    gate.reject(new Error("Network down"));

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(result.current.tasks.data?.map((t) => t.id)).toEqual(["seed-t7"]);
  });

  it("deletes the task in the repository", async () => {
    const { result } = renderWithRepos(() => useDeleteTask());

    act(() => result.current.mutate("seed-t7"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(await repos.tasks.getByList("seed-groceries")).toEqual([]);
  });
});

describe("list mutations", () => {
  it("creates a list, showing it before the repository answers", async () => {
    const gate = deferred();
    const create = repos.lists.create;
    repos.lists.create = async (input) => {
      await gate.promise;
      return create(input);
    };
    const { result } = renderWithRepos(() => ({ lists: useLists(), create: useCreateList() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() => result.current.create.mutate({ name: "Reading", sortOrder: 4 }));

    await waitFor(() =>
      expect(result.current.lists.data?.at(-1)).toMatchObject({
        name: "Reading",
        id: expect.stringMatching(/^optimistic-/),
      }),
    );
    gate.resolve();
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    await waitFor(() =>
      expect(result.current.lists.data?.at(-1)?.id).toBe(result.current.create.data?.id),
    );
  });

  it("removes the placeholder list when the create fails", async () => {
    repos.lists.create = async () => {
      throw new Error("Network down");
    };
    const { result } = renderWithRepos(() => ({ lists: useLists(), create: useCreateList() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() => result.current.create.mutate({ name: "Reading" }));

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(result.current.lists.data?.map((list) => list.name)).not.toContain("Reading");
  });

  it("renames a list and rolls back if the rename fails", async () => {
    const { result } = renderWithRepos(() => ({ lists: useLists(), update: useUpdateList() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() => result.current.update.mutate({ id: "seed-work", patch: { name: "Office" } }));
    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.lists.data?.[1].name).toBe("Office"));

    repos.lists.update = async () => {
      throw new Error("Network down");
    };
    act(() => result.current.update.mutate({ id: "seed-work", patch: { name: "Job" } }));
    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(result.current.lists.data?.[1].name).toBe("Office");
  });

  it("deletes a list and drops its tasks from the cache", async () => {
    const { result } = renderWithRepos(() => ({
      lists: useLists(),
      tasks: useTasks("seed-groceries"),
      remove: useDeleteList(),
    }));
    await waitFor(() => expect(result.current.tasks.data).toHaveLength(1));

    act(() => result.current.remove.mutate({ id: "seed-groceries", moveTasksTo: null }));

    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    await waitFor(() => {
      expect(result.current.lists.data?.map((list) => list.id)).not.toContain("seed-groceries");
      expect(result.current.tasks.data).toEqual([]);
    });
  });

  it("restores a list if the delete fails", async () => {
    repos.lists.delete = async () => {
      throw new Error("Network down");
    };
    const { result } = renderWithRepos(() => ({ lists: useLists(), remove: useDeleteList() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() => result.current.remove.mutate({ id: "seed-groceries", moveTasksTo: null }));

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(result.current.lists.data?.map((list) => list.id)).toContain("seed-groceries");
  });
});

describe("list deletion with a move", () => {
  it("moves the tasks to the Inbox and deletes the list", async () => {
    const { result } = renderWithRepos(() => ({
      lists: useLists(),
      inbox: useTasks("seed-inbox"),
      remove: useDeleteList(),
    }));
    await waitFor(() => expect(result.current.inbox.data).toHaveLength(1));

    act(() => result.current.remove.mutate({ id: "seed-work", moveTasksTo: "seed-inbox" }));

    await waitFor(() => expect(result.current.remove.isSuccess).toBe(true));
    await waitFor(() => {
      expect(result.current.lists.data?.map((list) => list.id)).not.toContain("seed-work");
      expect(result.current.inbox.data).toHaveLength(4);
    });
  });
});

describe("useInbox", () => {
  it("creates the Inbox once for a user with no lists, even with two consumers", async () => {
    repos = createMockRepos({ latencyMs: 5 });
    const { result } = renderWithRepos(() => ({
      first: useInbox(),
      second: useInbox(),
      lists: useLists(),
    }));

    await waitFor(() => expect(result.current.lists.data).toHaveLength(1));

    expect(result.current.first.data?.name).toBe("Inbox");
    expect(await repos.lists.getAll()).toHaveLength(1);
  });

  it("returns the existing Inbox", async () => {
    const { result } = renderWithRepos(() => useInbox());

    await waitFor(() => expect(result.current.data?.id).toBe("seed-inbox"));
  });
});

describe("useTaskCounts", () => {
  it("counts open and total tasks per list", async () => {
    const { result } = renderWithRepos(() =>
      useTaskCounts(["seed-inbox", "seed-work", "seed-personal", "seed-groceries"]),
    );

    await waitFor(() =>
      expect(result.current).toEqual({
        "seed-inbox": { open: 1, total: 1 },
        "seed-work": { open: 2, total: 3 },
        "seed-personal": { open: 2, total: 2 },
        "seed-groceries": { open: 1, total: 1 },
      }),
    );
  });

  it("leaves a list out until its tasks have loaded", () => {
    const { result } = renderWithRepos(() => useTaskCounts(["seed-work"]));

    expect(result.current).toEqual({});
  });
});

describe("useReorderLists", () => {
  it("shows the new order immediately and persists it", async () => {
    const gate = deferred();
    const update = repos.lists.update;
    repos.lists.update = async (id, patch) => {
      await gate.promise;
      return update(id, patch);
    };
    const { result } = renderWithRepos(() => ({ lists: useLists(), reorder: useReorderLists() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() =>
      result.current.reorder.mutate([
        { id: "seed-work", sortOrder: 2 },
        { id: "seed-personal", sortOrder: 1 },
      ]),
    );

    await waitFor(() =>
      expect(result.current.lists.data?.map((list) => list.name)).toEqual([
        "Inbox",
        "Personal",
        "Work",
        "Groceries",
      ]),
    );
    gate.resolve();
    await waitFor(() => expect(result.current.reorder.isSuccess).toBe(true));
    expect((await repos.lists.getAll()).map((list) => list.name)).toEqual([
      "Inbox",
      "Personal",
      "Work",
      "Groceries",
    ]);
  });

  it("restores the previous order if saving fails", async () => {
    repos.lists.update = async () => {
      throw new Error("Network down");
    };
    const { result } = renderWithRepos(() => ({ lists: useLists(), reorder: useReorderLists() }));
    await waitFor(() => expect(result.current.lists.isSuccess).toBe(true));

    act(() => result.current.reorder.mutate([{ id: "seed-groceries", sortOrder: 0 }]));

    await waitFor(() => expect(result.current.reorder.isError).toBe(true));
    expect(result.current.lists.data?.map((list) => list.name)).toEqual([
      "Inbox",
      "Work",
      "Personal",
      "Groceries",
    ]);
  });
});

describe("useCompletedTasks", () => {
  it("gathers completed tasks from every list, most recent first", async () => {
    await repos.tasks.update("seed-t7", {
      isCompleted: true,
      completedOn: new Date(2026, 8, 17, 8),
    });
    const { result } = renderWithRepos(() =>
      useCompletedTasks(["seed-inbox", "seed-work", "seed-groceries"]),
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.tasks.map((task) => task.title)).toEqual([
      "Buy milk",
      "Review the pull request",
    ]);
  });

  it("is pending until every list has loaded and reports a failure", async () => {
    repos.tasks.getByList = async (listId) => {
      if (listId === "seed-work") throw new Error("Network down");
      return [];
    };
    const { result } = renderWithRepos(() => useCompletedTasks(["seed-inbox", "seed-work"]));

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
