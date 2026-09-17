import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import type { Repos } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { DataverseSmoke } from "./DataverseSmoke";

function renderSmoke(repos: Repos = createMockRepos()) {
  render(<DataverseSmoke />, { wrapper: createWrapper(repos) });
  return repos;
}

describe("DataverseSmoke", () => {
  it("offers only the first step until it has run", () => {
    renderSmoke();

    expect(screen.getByRole("button", { name: "Create list" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Create task" })).toBeDisabled();
  });

  it("walks create list, create task, complete, delete task, delete list against the repositories", async () => {
    const user = userEvent.setup();
    const repos = renderSmoke();

    await user.click(screen.getByRole("button", { name: "Create list" }));
    expect(await screen.findByText(/Created list/)).toBeInTheDocument();
    const [list] = await repos.lists.getAll();
    expect(list.name).toMatch(/^Smoke test /);

    await user.click(screen.getByRole("button", { name: "Create task" }));
    expect(await screen.findByText(/Created task/)).toBeInTheDocument();
    const [task] = await repos.tasks.getByList(list.id);
    expect(task.listId).toBe(list.id);

    await user.click(screen.getByRole("button", { name: "Mark task complete" }));
    expect(await screen.findByText(/Marked task complete/)).toBeInTheDocument();
    expect((await repos.tasks.getByList(list.id))[0].isCompleted).toBe(true);

    await user.click(screen.getByRole("button", { name: "Delete task" }));
    expect(await screen.findByText(/Deleted task/)).toBeInTheDocument();
    expect(await repos.tasks.getByList(list.id)).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Delete list" }));
    expect(await screen.findByText(/Deleted list/)).toBeInTheDocument();
    expect(await repos.lists.getAll()).toEqual([]);
  });

  it("shows the error when a step fails and lets it be retried", async () => {
    const user = userEvent.setup();
    const repos = createMockRepos();
    const create = repos.lists.create;
    let fail = true;
    repos.lists.create = (input) =>
      fail ? Promise.reject(new Error("Principal user is missing a privilege")) : create(input);
    renderSmoke(repos);

    await user.click(screen.getByRole("button", { name: "Create list" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Principal user is missing a privilege",
    );

    fail = false;
    await user.click(screen.getByRole("button", { name: "Create list" }));
    expect(await screen.findByText(/Created list/)).toBeInTheDocument();
  });
});
