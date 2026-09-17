import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { TaskList } from "./TaskList";

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(new Date()) });
});

function renderList(listId = "seed-work") {
  return render(<TaskList listId={listId} listName="Work" />, { wrapper: createWrapper(repos) });
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
});
