import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRepos } from "@/data/mock/mockRepos";
import { createSampleSeed } from "@/data/mock/seed";
import { useTasks } from "@/data/queries";
import type { Repos, TaskPatch } from "@/data/repo";
import { createWrapper } from "@/test/renderWithProviders";
import { TaskDetail } from "./TaskDetail";

/** Thursday 17 September 2026, 09:30. Seed task t3 is due today at 15:00 with a 14:50 reminder. */
const now = new Date(2026, 8, 17, 9, 30);
let repos: Repos;
let patches: TaskPatch[];

beforeEach(() => {
  repos = createMockRepos({ seed: createSampleSeed(now) });
  patches = [];
  const update = repos.tasks.update;
  repos.tasks.update = (id, patch) => {
    patches.push(patch);
    return update(id, patch);
  };
});

function Harness({ listId, id, onClose }: { listId: string; id: string; onClose: () => void }) {
  const task = useTasks(listId).data?.find((t) => t.id === id);
  return task ? <TaskDetail task={task} onClose={onClose} /> : null;
}

async function renderDetail(id: string) {
  const listId = id === "seed-t1" ? "seed-inbox" : "seed-work";
  const onClose = vi.fn();
  render(<Harness listId={listId} id={id} onClose={onClose} />, { wrapper: createWrapper(repos) });
  await screen.findByRole("region", { name: "Task details" });
  return { onClose };
}

describe("TaskDetail", () => {
  it("opens as a labelled region with the title field focused", async () => {
    await renderDetail("seed-t3");

    const region = screen.getByRole("region", { name: "Task details" });
    expect(within(region).getByLabelText("Title")).toHaveValue("Call Sam about the offsite");
    expect(within(region).getByLabelText("Title")).toHaveFocus();
  });

  it("saves a new title on Enter, sending only the title", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");

    await user.clear(screen.getByLabelText("Title"));
    await user.keyboard("Call Sam about Friday{Enter}");

    await waitFor(() => expect(patches).toEqual([{ title: "Call Sam about Friday" }]));
  });

  it("sends nothing when a field loses focus unchanged, and restores a blank title", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");

    await user.click(screen.getByLabelText("Notes"));
    await user.click(screen.getByLabelText("Title"));
    await user.clear(screen.getByLabelText("Title"));
    await user.click(screen.getByLabelText("Notes"));

    expect(screen.getByLabelText("Title")).toHaveValue("Call Sam about the offsite");
    expect(patches).toEqual([]);
  });

  it("saves notes on blur", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");

    await user.click(screen.getByLabelText("Notes"));
    await user.keyboard("Bring the agenda{Enter}and the budget");
    await user.click(screen.getByLabelText("Title"));

    await waitFor(() => expect(patches).toEqual([{ notes: "Bring the agenda\nand the budget" }]));
  });

  it("moves the reminder with the due date", async () => {
    await renderDetail("seed-t3");

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-09-18" } });
    fireEvent.blur(screen.getByLabelText("Due date"));

    await waitFor(() =>
      expect(patches).toEqual([
        { dueDate: new Date(2026, 8, 18, 15, 0), reminderAt: new Date(2026, 8, 18, 14, 50) },
      ]),
    );
  });

  it("clearing the time keeps the date and reminds at 9:00 less the offset", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");

    await user.click(screen.getByRole("button", { name: "Clear time" }));

    await waitFor(() =>
      expect(patches).toEqual([
        {
          dueDate: new Date(2026, 8, 17),
          hasTime: false,
          reminderAt: new Date(2026, 8, 17, 8, 50),
        },
      ]),
    );
    expect(screen.getByText("Date-only tasks remind at 9:00.")).toBeInTheDocument();
  });

  it("sets the reminder from an offset", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");
    const reminder = screen.getByLabelText("Reminder");
    expect(reminder).toHaveValue("10m");

    await user.selectOptions(reminder, "1 hour before");

    await waitFor(() => expect(patches).toEqual([{ reminderAt: new Date(2026, 8, 17, 14, 0) }]));
  });

  it("sets the repeat", async () => {
    const user = userEvent.setup();
    await renderDetail("seed-t3");

    await user.selectOptions(screen.getByLabelText("Repeat"), "Weekly");

    await waitFor(() => expect(patches).toEqual([{ recurrence: "weekly" }]));
  });

  it("clears reminder and repeat with the due date", async () => {
    const user = userEvent.setup();
    await repos.tasks.update("seed-t3", { recurrence: "daily" });
    patches = [];
    await renderDetail("seed-t3");

    await user.click(screen.getByRole("button", { name: "Clear due date" }));

    await waitFor(() =>
      expect(patches).toEqual([
        { dueDate: null, hasTime: false, reminderAt: null, recurrence: "none" },
      ]),
    );
  });

  it("disables reminder and repeat without a due date, and says why", async () => {
    await renderDetail("seed-t1");

    expect(screen.getByLabelText("Reminder")).toBeDisabled();
    expect(screen.getByLabelText("Repeat")).toBeDisabled();
    expect(screen.getByText("Set a due date to add a reminder or repeat.")).toBeInTheDocument();
  });

  it("closes on Escape and from its close button", async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDetail("seed-t3");

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close details" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on Escape even when focus has left the panel", async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDetail("seed-t3");

    act(() => (document.activeElement as HTMLElement).blur());
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the backdrop shown behind the mobile sheet", async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDetail("seed-t3");

    await user.click(screen.getByTestId("detail-backdrop"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("deletes the task and brings it back with Undo", async () => {
    const user = userEvent.setup();
    const { onClose } = await renderDetail("seed-t3");

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(onClose).toHaveBeenCalled();
    await waitFor(async () =>
      expect((await repos.tasks.getByList("seed-work")).map((t) => t.title)).not.toContain(
        "Call Sam about the offsite",
      ),
    );
    expect(screen.getByText("Deleted Call Sam about the offsite")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(async () =>
      expect(
        (await repos.tasks.getByList("seed-work")).find(
          (t) => t.title === "Call Sam about the offsite",
        ),
      ).toMatchObject({
        dueDate: new Date(2026, 8, 17, 15, 0),
        hasTime: true,
        reminderAt: new Date(2026, 8, 17, 14, 50),
        sortOrder: 1,
      }),
    );
  });

  it("offers Retry when the delete fails", async () => {
    const user = userEvent.setup();
    repos.tasks.delete = async () => {
      throw new Error("Network down");
    };
    await renderDetail("seed-t3");

    await user.click(screen.getByRole("button", { name: "Delete task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't delete Call Sam about the offsite.",
    );
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("includes the task's subtask checklist", async () => {
    render(<Harness listId="seed-personal" id="seed-t6" onClose={() => {}} />, {
      wrapper: createWrapper(repos),
    });

    const region = await screen.findByRole("region", { name: "Task details" });
    expect(await within(region).findByRole("list", { name: "Subtasks" })).toBeInTheDocument();
    expect(within(region).getByRole("textbox", { name: "Add a subtask" })).toBeInTheDocument();
  });

  it("stops a repeating task on this instance only, and hides the button otherwise", async () => {
    const user = userEvent.setup();
    const updatedIds: string[] = [];
    const update = repos.tasks.update;
    repos.tasks.update = (id, patch) => {
      updatedIds.push(id);
      return update(id, patch);
    };
    render(<Harness listId="seed-personal" id="seed-t5" onClose={() => {}} />, {
      wrapper: createWrapper(repos),
    });
    await screen.findByRole("region", { name: "Task details" });

    await user.click(screen.getByRole("button", { name: "Stop repeating" }));

    await waitFor(() => expect(patches).toEqual([{ recurrence: "none" }]));
    expect(updatedIds).toEqual(["seed-t5"]);
    expect(screen.getByLabelText("Repeat")).toHaveValue("none");
    expect(screen.queryByRole("button", { name: "Stop repeating" })).not.toBeInTheDocument();
  });
});
