import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { useCreateTask } from "@/data/queries";
import { createWrapper, deferred } from "@/test/renderWithProviders";
import { TaskList } from "./TaskList";

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(new Date()) });
});

/** Adds a task through the real mutation, as quick add would, without typing into a field. */
function AddTask() {
  const { mutate } = useCreateTask();
  return (
    <button
      type="button"
      onClick={() => mutate({ listId: "seed-work", title: "New", sortOrder: 9 })}
    >
      Add task (test)
    </button>
  );
}

function renderList(listId = "seed-work") {
  return render(
    <>
      <TaskList listId={listId} listName="Work" />
      <AddTask />
    </>,
    { wrapper: createWrapper(repos) },
  );
}

const openTitles = () =>
  within(screen.getByRole("list", { name: "Open tasks" }))
    .queryAllByRole("listitem")
    .map((row) => row.querySelector("[data-title]")?.textContent);

const stored = async (id: string) =>
  (await repos.tasks.getByList("seed-work")).find((task) => task.id === id);

describe("TaskList", () => {
  it("shows open tasks with overdue first and completed ones collapsed", async () => {
    const user = userEvent.setup();
    renderList();

    await waitFor(() =>
      expect(openTitles()).toEqual(["Send the Q3 budget draft", "Call Sam about the offsite"]),
    );
    const toggle = screen.getByRole("button", { name: "Completed (1)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Review the pull request")).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      within(screen.getByRole("list", { name: "Completed tasks" })).getByText(
        "Review the pull request",
      ),
    ).toBeInTheDocument();
  });

  it("completes a task at once, offers Undo, then moves it to Completed", async () => {
    const user = userEvent.setup();
    renderList();
    const box = await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" });

    await user.click(box);

    expect(box).toHaveAttribute("aria-checked", "true");
    expect(box.closest("li")).toHaveAttribute("data-state", "success");
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(within(region).getByText("Completed Send the Q3 budget draft")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await waitFor(() => expect(openTitles()).toEqual(["Call Sam about the offsite"]));
    expect(screen.getByRole("button", { name: "Completed (2)" })).toBeInTheDocument();
    await waitFor(async () => expect((await stored("seed-t2"))?.isCompleted).toBe(true));
  });

  it("undoes a completion from the toast", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(
      await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    );

    await user.click(screen.getByRole("button", { name: "Undo" }));

    const box = screen.getByRole("checkbox", { name: "Complete Send the Q3 budget draft" });
    expect(box).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Completed Send the Q3 budget draft")).not.toBeInTheDocument();
    await waitFor(async () => expect((await stored("seed-t2"))?.isCompleted).toBe(false));
    expect(openTitles()).toEqual(["Send the Q3 budget draft", "Call Sam about the offsite"]);
  });

  it("restores the row and offers Retry when completing fails", async () => {
    const user = userEvent.setup();
    const update = repos.tasks.update;
    repos.tasks.update = async () => {
      throw new Error("Network down");
    };
    renderList();
    await user.click(
      await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't complete Send the Q3 budget draft.");
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    ).toHaveAttribute("aria-checked", "false");

    repos.tasks.update = update;
    await user.click(within(alert).getByRole("button", { name: "Retry" }));

    await waitFor(async () => expect((await stored("seed-t2"))?.isCompleted).toBe(true));
  });

  it("reopens a completed task without offering Undo", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(await screen.findByRole("button", { name: "Completed (1)" }));

    await user.click(screen.getByRole("checkbox", { name: "Complete Review the pull request" }));

    await waitFor(() => expect(openTitles()).toContain("Review the pull request"));
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Completed/ })).not.toBeInTheDocument();
  });

  it("is busy while loading and offers a retry when loading fails", async () => {
    const user = userEvent.setup();
    const getByList = repos.tasks.getByList;
    repos.tasks.getByList = async () => {
      throw new Error("Network down");
    };
    renderList();

    expect(screen.getByRole("list", { name: "Open tasks" })).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByRole("alert")).toHaveTextContent("Work didn't load.");
    repos.tasks.getByList = getByList;
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(openTitles()).toHaveLength(2));
  });

  it("says when a list has no tasks", async () => {
    const list = await repos.lists.create({ name: "Empty" });
    render(<TaskList listId={list.id} listName="Empty" />, { wrapper: createWrapper(repos) });

    expect(await screen.findByText("No tasks in Empty.")).toBeInTheDocument();
  });

  it("says so and offers Retry when an undo fails", async () => {
    const user = userEvent.setup();
    renderList();
    await user.click(
      await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    );
    await waitFor(async () => expect((await stored("seed-t2"))?.isCompleted).toBe(true));
    const update = repos.tasks.update;
    repos.tasks.update = async () => {
      throw new Error("Network down");
    };

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't undo. Send the Q3 budget draft is still completed.",
    );
    repos.tasks.update = update;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(async () => expect((await stored("seed-t2"))?.isCompleted).toBe(false));
  });

  describe("task detail", () => {
    it("opens inline from the task title and closes on a second click", async () => {
      const user = userEvent.setup();
      renderList();
      const title = await screen.findByRole("button", { name: "Send the Q3 budget draft" });
      expect(title).toHaveAttribute("aria-expanded", "false");

      await user.click(title);

      expect(title).toHaveAttribute("aria-expanded", "true");
      const region = screen.getByRole("region", { name: "Task details" });
      expect(title.closest("li")).toContainElement(region);
      expect(title).toHaveAttribute("aria-controls", region.id);

      await user.click(title);
      expect(screen.queryByRole("region", { name: "Task details" })).not.toBeInTheDocument();
    });

    it("keeps one panel open at a time", async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await screen.findByRole("button", { name: "Send the Q3 budget draft" }));
      await user.click(screen.getByRole("button", { name: "Call Sam about the offsite" }));

      const regions = screen.getAllByRole("region", { name: "Task details" });
      expect(regions).toHaveLength(1);
      expect(within(regions[0]).getByLabelText("Title")).toHaveValue("Call Sam about the offsite");
    });

    it("opens the selected task with e and closes with Escape, returning focus", async () => {
      const user = userEvent.setup();
      renderList();
      const title = await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("e");
      expect(screen.queryByRole("region", { name: "Task details" })).not.toBeInTheDocument();

      act(() => title.focus());
      expect(title.closest("li")).toHaveAttribute("data-selected", "true");
      await user.keyboard("e");
      expect(screen.getByLabelText("Title")).toHaveFocus();

      await user.keyboard("{Escape}");
      expect(screen.queryByRole("region", { name: "Task details" })).not.toBeInTheDocument();
      expect(title).toHaveFocus();
    });

    it("removes the row when the task is deleted from its panel", async () => {
      const user = userEvent.setup();
      renderList();

      await user.click(await screen.findByRole("button", { name: "Send the Q3 budget draft" }));
      await user.click(screen.getByRole("button", { name: "Delete task" }));

      await waitFor(() => expect(openTitles()).toEqual(["Call Sam about the offsite"]));
      expect(screen.queryByRole("region", { name: "Task details" })).not.toBeInTheDocument();
    });
  });

  describe("keyboard", () => {
    const selectedTitle = () =>
      document.querySelector("li[data-selected] [data-title]")?.textContent ?? null;

    it("moves the selection down with j and up with k, focusing the task", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("j");
      expect(selectedTitle()).toBe("Send the Q3 budget draft");
      expect(screen.getByRole("button", { name: "Send the Q3 budget draft" })).toHaveFocus();

      await user.keyboard("j");
      expect(selectedTitle()).toBe("Call Sam about the offsite");
      await user.keyboard("j");
      expect(selectedTitle()).toBe("Call Sam about the offsite");

      await user.keyboard("k");
      expect(selectedTitle()).toBe("Send the Q3 budget draft");
      await user.keyboard("k");
      expect(selectedTitle()).toBe("Send the Q3 budget draft");
    });

    it("starts from the last task with k and continues into expanded completed tasks", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("k");
      expect(selectedTitle()).toBe("Call Sam about the offsite");

      await user.click(screen.getByRole("button", { name: "Completed (1)" }));
      await user.keyboard("j");
      expect(selectedTitle()).toBe("Review the pull request");
    });

    it("completes the selected task with x", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("jx");

      expect(
        screen.getByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
      ).toHaveAttribute("aria-checked", "true");
      expect(screen.getByText("Completed Send the Q3 budget draft")).toBeInTheDocument();
    });

    it("deletes the selected task with Backspace and selects the next one", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("j{Backspace}");

      await waitFor(() => expect(openTitles()).toEqual(["Call Sam about the offsite"]));
      expect(screen.getByText("Deleted Send the Q3 budget draft")).toBeInTheDocument();
      expect(selectedTitle()).toBe("Call Sam about the offsite");
      expect(screen.getByRole("button", { name: "Call Sam about the offsite" })).toHaveFocus();
    });

    it("selects the previous task after deleting the last one, with Delete too", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("jj{Delete}");

      await waitFor(() => expect(openTitles()).toEqual(["Send the Q3 budget draft"]));
      expect(selectedTitle()).toBe("Send the Q3 budget draft");
    });

    it("does nothing with x or Backspace when no task is selected", async () => {
      const user = userEvent.setup();
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });

      await user.keyboard("x{Backspace}");

      expect(openTitles()).toHaveLength(2);
      expect(screen.queryByText(/^Completed Send|^Deleted/)).not.toBeInTheDocument();
    });

    it("keeps the selection while another task is added and saved", async () => {
      const user = userEvent.setup();
      const gate = deferred();
      const create = repos.tasks.create;
      repos.tasks.create = async (input) => {
        await gate.promise;
        return create(input);
      };
      renderList();
      await screen.findByRole("button", { name: "Call Sam about the offsite" });
      await user.keyboard("jj");
      const title = screen.getByRole("button", { name: "Call Sam about the offsite" });

      await user.click(screen.getByRole("button", { name: "Add task (test)" }));
      await waitFor(() => expect(openTitles()).toHaveLength(3));
      expect(selectedTitle()).toBe("Call Sam about the offsite");
      await act(async () => gate.resolve());
      await waitFor(async () => expect(await repos.tasks.getByList("seed-work")).toHaveLength(4));

      expect(selectedTitle()).toBe("Call Sam about the offsite");
      expect(screen.getByRole("button", { name: "Call Sam about the offsite" })).toBe(title);
    });
  });
});
