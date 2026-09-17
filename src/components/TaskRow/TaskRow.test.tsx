import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { taskDefaults } from "@/data/defaults";
import type { Task } from "@/data/repo";
import { TaskRow } from "./TaskRow";

const now = new Date(2026, 8, 17, 9, 30);

function task(fields: Partial<Task> = {}): Task {
  return { ...taskDefaults, id: "t1", listId: "l1", title: "Buy milk", ...fields };
}

function renderRow(props: Partial<Parameters<typeof TaskRow>[0]> = {}) {
  return render(
    <ul>
      <TaskRow task={task()} now={now} onToggle={() => {}} {...props} />
    </ul>,
  );
}

describe("TaskRow", () => {
  it("shows the title with a labelled checkmark", () => {
    renderRow();

    expect(screen.getByRole("listitem")).toHaveTextContent("Buy milk");
    expect(screen.getByRole("checkbox", { name: "Complete Buy milk" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("shows a due chip, and no chip without a due date", () => {
    const { unmount } = renderRow({
      task: task({ dueDate: new Date(2026, 8, 18, 15), hasTime: true }),
    });

    expect(screen.getByText(/^Tomorrow, /)).toBeInTheDocument();
    unmount();

    renderRow();
    expect(screen.queryByText(/Today|Tomorrow/)).not.toBeInTheDocument();
  });

  it("marks an overdue task in text as well as style", () => {
    renderRow({ task: task({ dueDate: new Date(2026, 8, 16) }) });

    expect(screen.getByRole("listitem")).toHaveAttribute("data-overdue", "true");
    expect(screen.getByText("Yesterday").closest("[data-due]")).toHaveTextContent(
      "Overdue: Yesterday",
    );
  });

  it("does not call a completed task overdue", () => {
    renderRow({
      task: task({ dueDate: new Date(2026, 8, 16), isCompleted: true, completedOn: now }),
    });

    expect(screen.getByRole("listitem")).not.toHaveAttribute("data-overdue");
    expect(screen.getByRole("listitem")).toHaveAttribute("data-completed", "true");
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("toggles through onToggle", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const row = task();
    renderRow({ task: row, onToggle });

    await user.click(screen.getByRole("checkbox"));

    expect(onToggle).toHaveBeenCalledWith(row);
  });

  it("is disabled and loading while the task has not been saved yet", () => {
    renderRow({ task: task({ id: "optimistic-3" }) });

    expect(screen.getByRole("listitem")).toHaveAttribute("data-state", "loading");
    expect(screen.getByRole("listitem")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("checkbox")).toBeDisabled();
  });

  it("passes loading and error states to the row and checkmark", () => {
    const { rerender } = renderRow({ state: "loading" });
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "loading");

    rerender(
      <ul>
        <TaskRow task={task()} now={now} onToggle={() => {}} state="error" />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "error");
  });

  it("shows the list name when given one", () => {
    renderRow({ listName: "Groceries" });

    expect(screen.getByText("Groceries")).toBeInTheDocument();
  });
});
