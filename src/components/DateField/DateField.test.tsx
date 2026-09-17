import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DateField } from "./DateField";

function renderField(dueDate: Date | null, hasTime: boolean) {
  const onCommit = vi.fn();
  render(<DateField dueDate={dueDate} hasTime={hasTime} onCommit={onCommit} />);
  return {
    onCommit,
    date: screen.getByLabelText("Due date") as HTMLInputElement,
    time: screen.getByLabelText("Time") as HTMLInputElement,
  };
}

describe("DateField", () => {
  it("shows the stored date and time in the native inputs", () => {
    const { date, time } = renderField(new Date(2026, 8, 18, 15, 5), true);

    expect(date).toHaveAttribute("type", "date");
    expect(date.value).toBe("2026-09-18");
    expect(time).toHaveAttribute("type", "time");
    expect(time.value).toBe("15:05");
  });

  it("commits a new date on blur, keeping the time", () => {
    const { date, onCommit } = renderField(new Date(2026, 8, 18, 15, 5), true);

    fireEvent.change(date, { target: { value: "2026-09-20" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.blur(date);

    expect(onCommit).toHaveBeenCalledWith({ dueDate: new Date(2026, 8, 20, 15, 5), hasTime: true });
  });

  it("commits on Enter", () => {
    const { date, onCommit } = renderField(null, false);

    fireEvent.change(date, { target: { value: "2026-09-20" } });
    fireEvent.keyDown(date, { key: "Enter" });

    expect(onCommit).toHaveBeenCalledWith({ dueDate: new Date(2026, 8, 20), hasTime: false });
  });

  it("does not commit when nothing changed", () => {
    const { date, time, onCommit } = renderField(new Date(2026, 8, 18, 15, 5), true);

    fireEvent.blur(date);
    fireEvent.blur(time);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("adds a time to a date-only task", () => {
    const { time, onCommit } = renderField(new Date(2026, 8, 18), false);

    fireEvent.change(time, { target: { value: "09:30" } });
    fireEvent.blur(time);

    expect(onCommit).toHaveBeenCalledWith({ dueDate: new Date(2026, 8, 18, 9, 30), hasTime: true });
  });

  it("clearing the time keeps the date and makes the task date-only", () => {
    const { time, onCommit } = renderField(new Date(2026, 8, 18, 15, 5), true);

    fireEvent.change(time, { target: { value: "" } });
    fireEvent.blur(time);

    expect(onCommit).toHaveBeenCalledWith({ dueDate: new Date(2026, 8, 18), hasTime: false });
  });

  it("has buttons to clear the time and the date", async () => {
    const user = userEvent.setup();
    const { date, time, onCommit } = renderField(new Date(2026, 8, 18, 15, 5), true);

    await user.click(screen.getByRole("button", { name: "Clear time" }));
    expect(onCommit).toHaveBeenLastCalledWith({ dueDate: new Date(2026, 8, 18), hasTime: false });
    expect(time.value).toBe("");
    expect(time).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Clear due date" }));
    expect(onCommit).toHaveBeenLastCalledWith({ dueDate: null, hasTime: false });
    expect(date.value).toBe("");
    expect(date).toHaveFocus();
  });

  it("disables the time and clear buttons until there is a date", () => {
    renderField(null, false);

    expect(screen.getByLabelText("Time")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Clear due date" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear time" })).not.toBeInTheDocument();
  });

  it("clears the date when the date input is emptied", () => {
    const { date, onCommit } = renderField(new Date(2026, 8, 18, 15, 5), true);

    fireEvent.change(date, { target: { value: "" } });
    fireEvent.blur(date);

    expect(onCommit).toHaveBeenCalledWith({ dueDate: null, hasTime: false });
  });
});
