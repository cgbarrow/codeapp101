import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import type { Repos, Subtask, SubtaskPatch } from "@/data/repo";
import { createWrapper, deferred } from "@/test/renderWithProviders";
import { MAX_SUBTASKS, SubtaskList } from "./SubtaskList";

const now = new Date(2026, 8, 17, 9, 30);
let repos: Repos;

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
});

async function renderList(taskId = "seed-t6") {
  render(<SubtaskList taskId={taskId} />, { wrapper: createWrapper(repos) });
  return screen.findByRole("list", { name: "Subtasks" });
}

const titles = () =>
  screen
    .getAllByRole("textbox", { name: /^Subtask \d+$/ })
    .map((input) => (input as HTMLInputElement).value);

const stored = () => repos.subtasks.getByTask("seed-t6");

describe("SubtaskList", () => {
  it("shows placeholder rows while subtasks load", async () => {
    render(<SubtaskList taskId="seed-t6" />, { wrapper: createWrapper(repos) });

    const list = screen.getByRole("list", { name: "Subtasks" });
    expect(list.querySelectorAll("[data-skeleton]").length).toBeGreaterThan(0);
    await within(list).findByRole("checkbox", { name: "Complete Charger" });
    expect(list.querySelectorAll("[data-skeleton]")).toHaveLength(0);
  });

  it("shows each subtask with its done state and a progress summary", async () => {
    await renderList();

    await waitFor(() => expect(titles()).toEqual(["Charger", "Walking boots", "Tickets"]));
    expect(screen.getByRole("checkbox", { name: "Complete Charger" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Complete Tickets" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
  });

  it("adds a subtask at the end on Enter and keeps the field focused for the next", async () => {
    const user = userEvent.setup();
    await renderList();
    await waitFor(() => expect(titles()).toHaveLength(3));

    await user.type(screen.getByRole("textbox", { name: "Add a subtask" }), "Rain jacket{Enter}");

    expect(titles()).toEqual(["Charger", "Walking boots", "Tickets", "Rain jacket"]);
    expect(screen.getByRole("textbox", { name: "Add a subtask" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Add a subtask" })).toHaveFocus();
    await waitFor(async () =>
      expect((await stored()).at(-1)).toMatchObject({ title: "Rain jacket", sortOrder: 3 }),
    );
  });

  it("ignores a blank subtask", async () => {
    const user = userEvent.setup();
    await renderList();
    await waitFor(() => expect(titles()).toHaveLength(3));

    await user.type(screen.getByRole("textbox", { name: "Add a subtask" }), "   {Enter}");

    expect(titles()).toHaveLength(3);
    expect(await stored()).toHaveLength(3);
  });

  it("toggles a subtask optimistically", async () => {
    const gate = deferred();
    const update = repos.subtasks.update;
    repos.subtasks.update = async (id, patch) => {
      await gate.promise;
      return update(id, patch);
    };
    const user = userEvent.setup();
    await renderList();

    await user.click(await screen.findByRole("checkbox", { name: "Complete Tickets" }));

    expect(screen.getByRole("checkbox", { name: "Complete Tickets" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("2 of 3 done")).toBeInTheDocument();
    gate.resolve();
    await waitFor(async () =>
      expect((await stored()).find((s) => s.title === "Tickets")?.isDone).toBe(true),
    );
  });

  it("renames a subtask on Enter, sending only the title", async () => {
    const patches: SubtaskPatch[] = [];
    const update = repos.subtasks.update;
    repos.subtasks.update = (id, patch) => {
      patches.push(patch);
      return update(id, patch);
    };
    const user = userEvent.setup();
    await renderList();

    const field = await screen.findByRole("textbox", { name: "Subtask 2" });
    await user.clear(field);
    await user.type(field, "Hiking boots{Enter}");

    await waitFor(() => expect(patches).toEqual([{ title: "Hiking boots" }]));
  });

  it("restores a blank title instead of saving it, and sends nothing when unchanged", async () => {
    const patches: SubtaskPatch[] = [];
    repos.subtasks.update = async (_id, patch) => {
      patches.push(patch);
      return {} as Subtask;
    };
    const user = userEvent.setup();
    await renderList();

    const field = await screen.findByRole("textbox", { name: "Subtask 1" });
    await user.click(field);
    await user.tab();
    await user.clear(field);
    await user.tab();

    expect(field).toHaveValue("Charger");
    expect(patches).toEqual([]);
  });

  it("moves a subtask up and down, with the ends disabled", async () => {
    const user = userEvent.setup();
    await renderList();
    await waitFor(() => expect(titles()).toHaveLength(3));

    expect(screen.getByRole("button", { name: "Move Charger up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Tickets down" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Move Tickets up" }));

    expect(titles()).toEqual(["Charger", "Tickets", "Walking boots"]);
    await waitFor(async () =>
      expect((await stored()).map((s) => s.title)).toEqual(["Charger", "Tickets", "Walking boots"]),
    );
  });

  it("deletes a subtask", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(await screen.findByRole("button", { name: "Delete Walking boots" }));

    expect(titles()).toEqual(["Charger", "Tickets"]);
    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    await waitFor(async () => expect(await stored()).toHaveLength(2));
  });

  it(`refuses a subtask beyond ${MAX_SUBTASKS} with an inline message`, async () => {
    const list = await repos.lists.create({ name: "Big" });
    const task = await repos.tasks.create({ listId: list.id, title: "Move house" });
    for (let i = 0; i < MAX_SUBTASKS; i++) {
      await repos.subtasks.create({ taskId: task.id, title: `Box ${i + 1}`, sortOrder: i });
    }
    const user = userEvent.setup();
    const listbox = await renderList(task.id);
    await waitFor(() =>
      expect(within(listbox).getAllByRole("listitem")).toHaveLength(MAX_SUBTASKS),
    );

    await user.type(screen.getByRole("textbox", { name: "Add a subtask" }), "Box 51{Enter}");

    const field = screen.getByRole("textbox", { name: "Add a subtask" });
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("A task can have up to 50 subtasks.");
    expect(field).toHaveValue("Box 51");
    expect(within(listbox).getAllByRole("listitem")).toHaveLength(MAX_SUBTASKS);
    expect(await repos.subtasks.getByTask(task.id)).toHaveLength(MAX_SUBTASKS);

    await user.click(screen.getByRole("button", { name: "Delete Box 1" }));
    expect(field).not.toHaveAttribute("aria-invalid");
  });

  it("offers Retry when saving a subtask fails, and rolls the change back", async () => {
    repos.subtasks.create = async () => {
      throw new Error("offline");
    };
    const user = userEvent.setup();
    await renderList();
    await waitFor(() => expect(titles()).toHaveLength(3));

    await user.type(screen.getByRole("textbox", { name: "Add a subtask" }), "Rain jacket{Enter}");

    expect(await screen.findByText("Couldn't add Rain jacket.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(titles()).toHaveLength(3);
  });

  it("disables adding while the task itself is still being saved", async () => {
    render(<SubtaskList taskId="optimistic-7" />, { wrapper: createWrapper(repos) });

    expect(await screen.findByRole("textbox", { name: "Add a subtask" })).toBeDisabled();
  });
});
