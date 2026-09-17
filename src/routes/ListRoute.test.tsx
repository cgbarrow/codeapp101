import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import { createWrapper } from "@/test/renderWithProviders";
import { ListRoute } from "./ListRoute";

function renderRoute(path: string) {
  const Providers = createWrapper(
    createMockRepos({ seed: createSampleSeed(new Date(2026, 8, 17, 9, 30)) }),
  );
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/list/:id" element={<ListRoute />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
}

describe("ListRoute", () => {
  it("shows the list name as the page heading", async () => {
    renderRoute("/list/seed-work");

    expect(await screen.findByRole("heading", { level: 1, name: "Work" })).toBeInTheDocument();
  });

  it("shows the list's tasks", async () => {
    renderRoute("/list/seed-work");

    expect(
      await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    ).toBeInTheDocument();
  });

  it("offers quick add for this list", async () => {
    renderRoute("/list/seed-work");

    expect(await screen.findByRole("textbox", { name: "Add a task" })).toBeInTheDocument();
  });

  it("says so when the list does not exist and links back to the Inbox", async () => {
    renderRoute("/list/missing");

    expect(
      await screen.findByRole("heading", { level: 1, name: "List not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Inbox" })).toHaveAttribute(
      "href",
      "/list/seed-inbox",
    );
  });
});
