import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createWrapper } from "@/test/renderWithProviders";

describe("App", () => {
  it("renders the app name as the page heading", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Simple Todo" })).toBeInTheDocument();
  });

  it("shows the Dataverse smoke test instead when it is switched on", async () => {
    render(<App smoke />, { wrapper: createWrapper(createMockRepos()) });

    expect(
      await screen.findByRole("heading", { level: 1, name: "Dataverse smoke test" }),
    ).toBeInTheDocument();
  });
});
