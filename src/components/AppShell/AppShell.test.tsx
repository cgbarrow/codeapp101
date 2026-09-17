import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, useNavigate } from "react-router";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

/** Stands in for the number-key shortcuts, which change list without a link. */
function GoToList() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/list/personal")}>
      Go to Personal
    </button>
  );
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/list/inbox"]}>
      <AppShell
        sidebar={
          <>
            <p>Sidebar content</p>
            <Link to="/list/work">Work</Link>
            <GoToList />
            <button type="button">Edit lists</button>
          </>
        }
      >
        <h1>Main content</h1>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  it("renders the sidebar in a labelled navigation region and children in main", () => {
    renderShell();

    expect(screen.getByRole("navigation", { name: "Lists" })).toHaveTextContent("Sidebar content");
    expect(screen.getByRole("main")).toHaveTextContent("Main content");
  });

  it("starts with the mobile list sheet closed", () => {
    renderShell();

    const toggle = screen.getByRole("button", { name: "Lists" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("navigation", { name: "Lists" })).toHaveAttribute("data-open", "false");
  });

  it("opens the sheet when the toggle is pressed", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Lists" }));

    expect(screen.getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Lists" })).toHaveAttribute("data-open", "true");
  });

  it("closes the sheet when the toggle is pressed again", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Lists" });

    await user.click(toggle);
    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the sheet on Escape and returns focus to the toggle", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Lists" });

    await user.click(toggle);
    await user.keyboard("{Escape}");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("moves focus into the sheet on open and closes from its close button", async () => {
    const user = userEvent.setup();
    renderShell();
    const toggle = screen.getByRole("button", { name: "Lists" });

    await user.click(toggle);
    const close = screen.getByRole("button", { name: "Close lists" });
    expect(close).toHaveFocus();
    await user.click(close);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });

  it("closes the sheet when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Lists" }));
    await user.click(screen.getByTestId("sheet-backdrop"));

    expect(screen.getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "false");
  });

  it("does not react to Escape while the sheet is closed", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.keyboard("{Escape}");

    expect(screen.getByRole("button", { name: "Lists" })).not.toHaveFocus();
  });

  it("closes the sheet when the view changes without a link, such as a new list", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Lists" }));
    await user.click(screen.getByRole("button", { name: "Go to Personal" }));

    expect(screen.getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the sheet when a link inside it is followed", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Lists" }));
    await user.click(screen.getByRole("link", { name: "Work" }));

    expect(screen.getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps the sheet open when another control inside it is used", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole("button", { name: "Lists" }));
    await user.click(screen.getByRole("button", { name: "Edit lists" }));

    expect(screen.getByRole("button", { name: "Lists" })).toHaveAttribute("aria-expanded", "true");
  });
});
