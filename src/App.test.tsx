import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
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

describe("App", () => {
  it("lands on the Inbox", async () => {
    renderApp(sampleRepos());

    expect(await screen.findByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
  });

  it("creates the Inbox for a new user and lands on it", async () => {
    const repos = createMockRepos();
    renderApp(repos);

    expect(await screen.findByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
    expect(await repos.lists.getAll()).toHaveLength(1);
  });

  it("shows a list from its route, with the lists in the sidebar", async () => {
    renderApp(sampleRepos(), "/list/seed-groceries");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Groceries" }),
    ).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Lists" });
    expect(await within(nav).findByRole("link", { name: /Work/ })).toBeInTheDocument();
  });

  it("sends an unknown route to the Inbox", async () => {
    renderApp(sampleRepos(), "/nowhere");

    expect(await screen.findByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
  });

  it("shows the Dataverse smoke test instead when it is switched on", async () => {
    renderApp(createMockRepos(), "/", true);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dataverse smoke test" }),
    ).toBeInTheDocument();
  });
});
