import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { TodayRoute } from "./TodayRoute";

/** Thursday 17 September 2026, 09:30. */
const now = new Date(2026, 8, 17, 9, 30);
let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
});

function renderRoute() {
  const Providers = createWrapper(repos);
  return render(
    <Providers>
      <MemoryRouter initialEntries={["/today"]}>
        <TodayRoute now={now} />
      </MemoryRouter>
    </Providers>,
  );
}

const titlesIn = (name: string) =>
  within(screen.getByRole("list", { name }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("[data-title]")?.textContent);

describe("TodayRoute", () => {
  it("groups overdue and due-today tasks from every list, Overdue first, then by list", async () => {
    renderRoute();

    expect(screen.getByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Overdue in Work" })).toBeInTheDocument();
    expect(titlesIn("Overdue in Work")).toEqual(["Send the Q3 budget draft"]);
    expect(titlesIn("Today in Work")).toEqual(["Call Sam about the offsite"]);
    expect(titlesIn("Today in Personal")).toEqual(["Water the plants"]);
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["Overdue", "Today"]);
    expect(screen.queryByText("Buy milk")).not.toBeInTheDocument();
    expect(screen.queryByText("Reply to the landlord")).not.toBeInTheDocument();
  });

  it("drops a completed task from the view and offers Undo", async () => {
    const user = userEvent.setup();
    renderRoute();

    await user.click(
      await screen.findByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
    );

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(within(region).getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("list", { name: "Overdue in Work" })).not.toBeInTheDocument(),
    );
  });

  it("adds quick-add tasks to the Inbox and says so", async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole("list", { name: "Today in Work" });

    await user.click(screen.getByRole("textbox", { name: "Add a task" }));
    await user.keyboard("Book the dentist today{Enter}");

    expect(await screen.findByRole("list", { name: "Today in Inbox" })).toHaveTextContent(
      "Book the dentist",
    );
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(within(region).getByText("Added Book the dentist to Inbox.")).toBeInTheDocument();
    await waitFor(async () =>
      expect((await repos.tasks.getByList("seed-inbox")).map((task) => task.title)).toContain(
        "Book the dentist",
      ),
    );
  });

  it("moves through tasks across groups with j and completes with x", async () => {
    const user = userEvent.setup();
    renderRoute();
    await screen.findByRole("list", { name: "Today in Personal" });

    await user.keyboard("jjj");
    expect(document.activeElement).toHaveTextContent("Water the plants");

    await user.keyboard("x");
    expect(screen.getByRole("checkbox", { name: "Complete Water the plants" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("holds the quick add and task areas open while they load, so nothing jumps", () => {
    renderRoute();

    // Before any query resolves: the add slot and the task area are already on the page.
    expect(document.querySelector("[data-add-slot]")).toBeInTheDocument();
    const rows = screen.getByRole("list", { name: "Today's tasks" });
    expect(rows).toHaveAttribute("aria-busy", "true");
    expect(rows.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-sections]")).toContainElement(rows);
  });

  it("shows the empty state when nothing is due", async () => {
    repos = createMockRepos({ seed: createSampleSeed(new Date(2020, 0, 1)) });
    for (const task of await repos.tasks.getOpenDueBefore(new Date(2030, 0, 1))) {
      await repos.tasks.update(task.id, { dueDate: null });
    }
    renderRoute();

    expect(await screen.findByText("Nothing due today.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Add a task" })).toBeInTheDocument();
  });

  it("offers a retry when tasks fail to load", async () => {
    repos.tasks.getByList = async () => {
      throw new Error("Network down");
    };
    renderRoute();

    expect(await screen.findByRole("alert")).toHaveTextContent("Today's tasks didn't load.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("Nothing due today.")).not.toBeInTheDocument();
  });
});
