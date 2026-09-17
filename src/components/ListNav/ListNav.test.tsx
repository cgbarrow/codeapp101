import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper, deferred } from "@/test/renderWithProviders";
import { ListNav } from "./ListNav";

let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(new Date(2026, 8, 17, 9, 30)) });
});

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderNav(path = "/list/seed-inbox") {
  const Providers = createWrapper(repos);
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <ListNav />
        <input aria-label="Elsewhere" />
        <Location />
      </MemoryRouter>
    </Providers>,
  );
}

const location = () => screen.getByTestId("location").textContent;
const navLinks = () =>
  within(screen.getByRole("list", { name: "Your lists" })).getAllByRole("link");
const listNames = () =>
  navLinks().map((link) => link.querySelector("[data-name]")?.textContent ?? "");

async function openEditMode(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("link", { name: /Work/ });
  await user.click(screen.getByRole("button", { name: "Edit lists" }));
}

describe("ListNav", () => {
  describe("navigation", () => {
    it("shows the lists in order with their open-task counts", async () => {
      renderNav();

      await waitFor(() =>
        expect(navLinks().map((link) => link.textContent)).toEqual([
          "Inbox1",
          "Work2",
          "Personal2",
          "Groceries1",
        ]),
      );
      expect(screen.getByRole("link", { name: "Work, 2 open tasks" })).toHaveAttribute(
        "href",
        "/list/seed-work",
      );
    });

    it("marks the open list as the current page", async () => {
      renderNav("/list/seed-personal");

      expect(await screen.findByRole("link", { name: /Personal/ })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: /Work/ })).not.toHaveAttribute("aria-current");
    });

    it("links to the Completed view", async () => {
      renderNav("/completed");

      const link = screen.getByRole("link", { name: "Completed" });
      expect(link).toHaveAttribute("href", "/completed");
      expect(link).toHaveAttribute("aria-current", "page");
    });

    it("hides archived lists", async () => {
      await repos.lists.update("seed-groceries", { isArchived: true });
      renderNav();

      await screen.findByRole("link", { name: /Work/ });
      expect(listNames()).toEqual(["Inbox", "Work", "Personal"]);
    });

    it("switches lists with the number keys", async () => {
      const user = userEvent.setup();
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.keyboard("3");
      expect(location()).toBe("/list/seed-personal");

      await user.keyboard("1");
      expect(location()).toBe("/list/seed-inbox");
    });

    it("goes to Today with t, and links to it above the lists", async () => {
      const user = userEvent.setup();
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.keyboard("t");

      expect(location()).toBe("/today");
      const views = screen.getByRole("list", { name: "Views" });
      expect(within(views).getByRole("link", { name: "Today" })).toHaveAttribute(
        "aria-current",
        "page",
      );
    });

    it("ignores number keys beyond the last list, with modifiers, or while typing", async () => {
      const user = userEvent.setup();
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.keyboard("9");
      await user.keyboard("{Control>}2{/Control}");
      await user.click(screen.getByRole("textbox", { name: "Elsewhere" }));
      await user.keyboard("2");

      expect(location()).toBe("/list/seed-inbox");
    });
  });

  describe("loading and errors", () => {
    it("is busy while the lists load", () => {
      renderNav();

      expect(screen.getByRole("list", { name: "Your lists" })).toHaveAttribute("aria-busy", "true");
    });

    it("offers a retry when the lists fail to load", async () => {
      const user = userEvent.setup();
      const getAll = repos.lists.getAll;
      repos.lists.getAll = async () => {
        throw new Error("Network down");
      };
      renderNav();

      expect(await screen.findByRole("alert")).toHaveTextContent("Your lists didn't load.");
      repos.lists.getAll = getAll;
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByRole("link", { name: /Work/ })).toBeInTheDocument();
    });
  });

  describe("first run", () => {
    it("creates the Inbox exactly once under StrictMode", async () => {
      repos = createMockRepos({ latencyMs: 5 });
      const Providers = createWrapper(repos);
      render(
        <StrictMode>
          <Providers>
            <MemoryRouter>
              <ListNav />
            </MemoryRouter>
          </Providers>
        </StrictMode>,
      );

      expect(await screen.findByRole("link", { name: /Inbox/ })).toBeInTheDocument();
      expect(await repos.lists.getAll()).toHaveLength(1);
    });
  });

  describe("creating", () => {
    it("adds a list at the end from the inline field and opens it", async () => {
      const user = userEvent.setup();
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.click(screen.getByRole("button", { name: "New list" }));
      await user.keyboard("Reading{Enter}");

      await waitFor(() =>
        expect(listNames()).toEqual(["Inbox", "Work", "Personal", "Groceries", "Reading"]),
      );
      const saved = (await repos.lists.getAll()).find((list) => list.name === "Reading");
      expect(saved?.sortOrder).toBe(4);
      await waitFor(() => expect(location()).toBe(`/list/${saved?.id}`));
    });

    it("shows the new list as disabled until the repository saves it", async () => {
      const user = userEvent.setup();
      const gate = deferred();
      const create = repos.lists.create;
      repos.lists.create = async (input) => {
        await gate.promise;
        return create(input);
      };
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.click(screen.getByRole("button", { name: "New list" }));
      await user.keyboard("Reading{Enter}");

      const pending = await screen.findByRole("link", { name: /Reading/ });
      expect(pending).toHaveAttribute("aria-disabled", "true");
      expect(pending).toHaveAttribute("data-state", "loading");
      await act(async () => gate.resolve());
      await waitFor(() =>
        expect(screen.getByRole("link", { name: /Reading/ })).not.toHaveAttribute("aria-disabled"),
      );
    });

    it("cancels with Escape and ignores a blank name", async () => {
      const user = userEvent.setup();
      renderNav();
      await screen.findByRole("link", { name: /Groceries/ });

      await user.click(screen.getByRole("button", { name: "New list" }));
      await user.keyboard("   {Enter}");
      await user.keyboard("Draft{Escape}");

      expect(screen.queryByRole("textbox", { name: "List name" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "New list" })).toHaveFocus();
      expect(await repos.lists.getAll()).toHaveLength(4);
    });
  });

  describe("editing", () => {
    it("renames a list inline and marks it saved", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Rename Work" }));
      const field = screen.getByRole("textbox", { name: "Rename Work" });
      await user.clear(field);
      await user.keyboard("Office{Enter}");

      const row = await screen.findByText("Office");
      await waitFor(() => expect(row.closest("li")).toHaveAttribute("data-state", "success"));
      expect((await repos.lists.getAll())[1].name).toBe("Office");
    });

    it("keeps the old name when a rename is cancelled with Escape", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Rename Work" }));
      await user.keyboard("{Control>}a{/Control}Office{Escape}");

      expect(screen.getByText("Work")).toBeInTheDocument();
      expect((await repos.lists.getAll())[1].name).toBe("Work");
    });

    it("rolls back a failed rename and offers a retry", async () => {
      const user = userEvent.setup();
      const update = repos.lists.update;
      repos.lists.update = async () => {
        throw new Error("Network down");
      };
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Rename Work" }));
      await user.clear(screen.getByRole("textbox", { name: "Rename Work" }));
      await user.keyboard("Office{Enter}");

      expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't rename Work.");
      expect(screen.getByText("Work")).toBeInTheDocument();
      repos.lists.update = update;
      await user.click(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByText("Office")).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    });

    it("does not offer to archive or delete the Inbox", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      expect(screen.getByRole("button", { name: "Archive Work" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Archive Inbox" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Delete Inbox" })).not.toBeInTheDocument();
    });

    it("archives a list and restores it", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Archive Personal" }));
      await waitFor(() => expect(listNames()).not.toContain("Personal"));

      const archived = screen.getByRole("list", { name: "Archived lists" });
      await user.click(within(archived).getByRole("button", { name: "Restore Personal" }));

      await waitFor(() => expect(listNames()).toContain("Personal"));
      expect((await repos.lists.getAll())[2].isArchived).toBe(false);
    });
  });

  describe("reordering", () => {
    it("moves a list down and up with buttons", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Move Work down" }));
      await waitFor(async () =>
        expect((await repos.lists.getAll()).map((list) => list.name)).toEqual([
          "Inbox",
          "Personal",
          "Work",
          "Groceries",
        ]),
      );

      await user.click(screen.getByRole("button", { name: "Move Work up" }));
      await waitFor(async () =>
        expect((await repos.lists.getAll()).map((list) => list.name)).toEqual([
          "Inbox",
          "Work",
          "Personal",
          "Groceries",
        ]),
      );
    });

    it("disables moving past either end", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      expect(screen.getByRole("button", { name: "Move Inbox up" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Move Groceries down" })).toBeDisabled();
    });

    it("reorders by dragging one list onto another", async () => {
      renderNav();
      const groceries = await screen.findByRole("link", { name: /Groceries/ });
      const work = screen.getByRole("link", { name: /Work/ });

      fireEvent.dragStart(groceries.closest("li")!);
      fireEvent.dragOver(work.closest("li")!);
      expect(work.closest("li")).toHaveAttribute("data-drop-target", "true");
      fireEvent.drop(work.closest("li")!);

      await waitFor(() => expect(listNames()).toEqual(["Inbox", "Groceries", "Work", "Personal"]));
      await waitFor(async () =>
        expect((await repos.lists.getAll()).map((list) => list.name)).toEqual([
          "Inbox",
          "Groceries",
          "Work",
          "Personal",
        ]),
      );
    });
  });

  describe("deleting", () => {
    it("deletes an empty list without asking", async () => {
      const user = userEvent.setup();
      await repos.lists.create({ name: "Empty", sortOrder: 4 });
      renderNav();
      await screen.findByRole("link", { name: /Empty/ });
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Delete Empty" }));

      await waitFor(() => expect(listNames()).not.toContain("Empty"));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("asks about a non-empty list and moves its tasks to the Inbox", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Delete Work" }));
      const prompt = screen.getByRole("alertdialog", { name: "Delete Work?" });
      expect(prompt).toHaveTextContent("Work has 3 tasks.");
      expect(within(prompt).getByRole("button", { name: "Move to Inbox" })).toHaveFocus();
      await user.click(within(prompt).getByRole("button", { name: "Move to Inbox" }));

      await waitFor(() => expect(listNames()).not.toContain("Work"));
      await waitFor(async () => expect(await repos.tasks.getByList("seed-inbox")).toHaveLength(4));
    });

    it("deletes a non-empty list with its tasks when asked to", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Delete Personal" }));
      await user.click(screen.getByRole("button", { name: "Delete list and tasks" }));

      await waitFor(() => expect(listNames()).not.toContain("Personal"));
      expect(await repos.tasks.getByList("seed-personal")).toEqual([]);
      expect(await repos.tasks.getByList("seed-inbox")).toHaveLength(1);
    });

    it("keeps the list when the prompt is cancelled", async () => {
      const user = userEvent.setup();
      renderNav();
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Delete Work" }));
      await user.keyboard("{Escape}");

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Delete Work" })).toHaveFocus();
      expect(await repos.lists.getAll()).toHaveLength(4);
    });

    it("goes to the Inbox after deleting the open list", async () => {
      const user = userEvent.setup();
      renderNav("/list/seed-groceries");
      await openEditMode(user);

      await user.click(screen.getByRole("button", { name: "Delete Groceries" }));
      await user.click(screen.getByRole("button", { name: "Move to Inbox" }));

      await waitFor(() => expect(location()).toBe("/list/seed-inbox"));
    });
  });
});
