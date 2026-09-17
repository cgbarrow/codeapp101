import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { CompletedRoute } from "./CompletedRoute";

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(new Date()) });
});

function renderRoute() {
  const Providers = createWrapper(repos);
  return render(
    <Providers>
      <MemoryRouter>
        <CompletedRoute />
      </MemoryRouter>
    </Providers>,
  );
}

describe("CompletedRoute", () => {
  it("lists completed tasks from every list, newest first, with their list names", async () => {
    await repos.tasks.update("seed-t7", { isCompleted: true, completedOn: new Date() });
    renderRoute();

    expect(screen.getByRole("heading", { level: 1, name: "Completed" })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Completed tasks" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
    const [first, second] = within(list).getAllByRole("listitem");
    expect(first).toHaveTextContent("Buy milk");
    expect(first).toHaveTextContent("Groceries");
    expect(second).toHaveTextContent("Review the pull request");
    expect(second).toHaveTextContent("Work");
  });

  it("reopens a task, removing it from the view", async () => {
    const user = userEvent.setup();
    renderRoute();

    await user.click(
      await screen.findByRole("checkbox", { name: "Complete Review the pull request" }),
    );

    await waitFor(() => expect(screen.queryByText("Review the pull request")).toBeNull());
    expect(await screen.findByText("No completed tasks.")).toBeInTheDocument();
    const [task] = (await repos.tasks.getByList("seed-work")).filter((t) => t.id === "seed-t4");
    expect(task.isCompleted).toBe(false);
  });

  it("offers a retry when tasks fail to load", async () => {
    repos.tasks.getByList = async () => {
      throw new Error("Network down");
    };
    renderRoute();

    expect(await screen.findByRole("alert")).toHaveTextContent("Completed tasks didn't load.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
