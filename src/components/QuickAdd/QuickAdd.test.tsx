import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TaskList } from "@/components/TaskList/TaskList";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos } from "@/data/repo";
import { createWrapper, deferred } from "@/test/renderWithProviders";
import { QuickAdd } from "./QuickAdd";

/** Thursday 17 September 2026, 09:30. */
const now = new Date(2026, 8, 17, 9, 30);
let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
});

function renderQuickAdd() {
  return render(
    <>
      <button type="button">Elsewhere</button>
      <QuickAdd listId="seed-groceries" now={now} />
      <TaskList listId="seed-groceries" listName="Groceries" now={now} />
    </>,
    { wrapper: createWrapper(repos) },
  );
}

const field = () => screen.getByRole("textbox", { name: "Add a task" });
const openRows = () =>
  within(screen.getByRole("list", { name: "Open tasks" })).queryAllByRole("listitem");
const saved = async () => repos.tasks.getByList("seed-groceries");

describe("QuickAdd", () => {
  it("previews the parsed date as a chip", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    await user.type(field(), "Buy eggs on Saturday");

    const chip = screen.getByRole("button", { name: /^Remove date/ });
    expect(chip).toHaveTextContent(/^Sat/);
  });

  it("shows the repeat in the chip", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    await user.type(field(), "Buy eggs every Monday");

    expect(screen.getByRole("button", { name: /^Remove date/ })).toHaveTextContent(
      /repeats weekly/,
    );
  });

  it("saves into the list on Enter, clears the field and keeps focus", async () => {
    const user = userEvent.setup();
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    await user.type(field(), "Buy eggs on Friday{Enter}");

    expect(field()).toHaveValue("");
    expect(field()).toHaveFocus();
    await waitFor(async () =>
      expect((await saved()).find((task) => task.title === "Buy eggs")).toMatchObject({
        dueDate: new Date(2026, 8, 18),
        hasTime: false,
        recurrence: "none",
        sortOrder: 1,
      }),
    );
  });

  it("saves on an Enter keydown alone, not only on form submission", async () => {
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    fireEvent.change(field(), { target: { value: "Buy eggs" } });
    fireEvent.keyDown(field(), { key: "Enter" });

    await waitFor(async () => expect(await saved()).toHaveLength(2));
  });

  it("does not save while an input method is composing", async () => {
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    fireEvent.change(field(), { target: { value: "Buy eggs" } });
    fireEvent.keyDown(field(), { key: "Enter", isComposing: true });

    expect(field()).toHaveValue("Buy eggs");
    expect(await saved()).toHaveLength(1);
  });

  it("shows the new row before the repository answers", async () => {
    const user = userEvent.setup();
    const gate = deferred();
    const create = repos.tasks.create;
    repos.tasks.create = async (input) => {
      await gate.promise;
      return create(input);
    };
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    await user.type(field(), "Call Sam tomorrow 3pm{Enter}");

    await waitFor(() =>
      expect(openRows().map((row) => row.textContent)).toContain("Call SamTomorrow, 3:00 PM"),
    );
    await act(async () => gate.resolve());
  });

  it("saves the whole text with no date once the chip is dismissed", async () => {
    const user = userEvent.setup();
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    await user.type(field(), "Watch Friday Night Lights");
    await user.click(screen.getByRole("button", { name: /^Remove date/ }));

    expect(screen.queryByRole("button", { name: /^Remove date/ })).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(async () =>
      expect(
        (await saved()).find((task) => task.title === "Watch Friday Night Lights"),
      ).toMatchObject({
        dueDate: null,
      }),
    );
  });

  it("cancels on Escape", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    await user.type(field(), "Buy eggs{Escape}");

    expect(field()).toHaveValue("");
    expect(field()).not.toHaveFocus();
    expect(await saved()).toHaveLength(1);
  });

  it("ignores Enter on an empty field", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    await user.type(field(), "   {Enter}");

    expect(await saved()).toHaveLength(1);
  });

  it("focuses from anywhere with n, without typing the n", async () => {
    const user = userEvent.setup();
    renderQuickAdd();
    screen.getByRole("button", { name: "Elsewhere" }).focus();

    await user.keyboard("n");

    expect(field()).toHaveFocus();
    expect(field()).toHaveValue("");
  });

  it("focuses with the add button, or adds when there is text", async () => {
    const user = userEvent.setup();
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });
    const add = screen.getByRole("button", { name: "Add task" });

    await user.click(add);
    expect(field()).toHaveFocus();

    await user.keyboard("Buy eggs");
    await user.click(add);
    await waitFor(async () => expect(await saved()).toHaveLength(2));
  });

  it("removes the row and offers Retry when saving fails", async () => {
    const user = userEvent.setup();
    const create = repos.tasks.create;
    repos.tasks.create = async () => {
      throw new Error("Network down");
    };
    renderQuickAdd();
    await screen.findByRole("checkbox", { name: "Complete Buy milk" });

    await user.type(field(), "Buy eggs{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Couldn't add Buy eggs.");
    await waitFor(() => expect(openRows()).toHaveLength(1));
    repos.tasks.create = create;
    await user.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(async () => expect(await saved()).toHaveLength(2));
  });
});
