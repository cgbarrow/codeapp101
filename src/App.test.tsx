import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "@/App";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";

function renderApp(repos: Repos, path = "/", smoke = false) {
  const Providers = createWrapper(repos);
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <App smoke={smoke} />
      </MemoryRouter>
    </Providers>,
  );
}

const sampleRepos = () => createMockRepos({ seed: createSampleSeed(new Date(2026, 8, 17, 9, 30)) });

beforeEach(() => localStorage.clear());

describe("App", () => {
  it("lands on Today", async () => {
    renderApp(sampleRepos());

    expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("creates the Inbox for a new user, for Today's quick add to file into", async () => {
    const repos = createMockRepos();
    renderApp(repos);

    expect(
      await screen.findByText("Nothing due today.", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(await repos.lists.getAll()).toHaveLength(1);
  });

  it("returns to the last view on the next visit", async () => {
    const first = renderApp(sampleRepos(), "/list/seed-groceries");
    expect(await screen.findByRole("heading", { level: 1, name: "Groceries" })).toBeInTheDocument();
    first.unmount();

    renderApp(sampleRepos());

    expect(await screen.findByRole("heading", { level: 1, name: "Groceries" })).toBeInTheDocument();
  });

  it("lands on Today when the remembered list has gone", async () => {
    localStorage.setItem("simple-todo:last-view", "/list/deleted");
    renderApp(sampleRepos());

    expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("shows the reminder status in the sidebar", async () => {
    renderApp(sampleRepos());

    const nav = screen.getByRole("navigation", { name: "Lists" });
    expect(within(nav).getByRole("group", { name: "Reminders" })).toBeInTheDocument();
  });

  it("shows a list from its route, with the lists in the sidebar", async () => {
    renderApp(sampleRepos(), "/list/seed-groceries");

    expect(await screen.findByRole("heading", { level: 1, name: "Groceries" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Lists" });
    expect(await within(nav).findByRole("link", { name: /Work/ })).toBeInTheDocument();
  });

  it("shows completed tasks at /completed", async () => {
    renderApp(sampleRepos(), "/completed");

    expect(await screen.findByRole("heading", { level: 1, name: "Completed" })).toBeInTheDocument();
  });

  it("offers the keyboard shortcut list from the sidebar", async () => {
    renderApp(sampleRepos(), "/list/seed-work");

    const nav = screen.getByRole("navigation", { name: "Lists" });
    expect(within(nav).getByRole("button", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });

  it("sends an unknown route to the landing view", async () => {
    renderApp(sampleRepos(), "/nowhere");

    expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("shows the Dataverse smoke test instead when it is switched on", async () => {
    renderApp(createMockRepos(), "/", true);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dataverse smoke test" }),
    ).toBeInTheDocument();
  });
});
