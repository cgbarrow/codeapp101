import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkmark, COMPLETION_MS } from "./Checkmark";

describe("Checkmark", () => {
  it("is a labelled checkbox reflecting its state", () => {
    const { rerender } = render(
      <Checkmark checked={false} label="Complete Buy milk" onChange={() => {}} />,
    );

    const box = screen.getByRole("checkbox", { name: "Complete Buy milk" });
    expect(box).toHaveAttribute("aria-checked", "false");
    rerender(<Checkmark checked label="Complete Buy milk" onChange={() => {}} />);
    expect(box).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange once per click and on Space", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkmark checked={false} label="Complete Buy milk" onChange={onChange} />);

    await user.click(screen.getByRole("checkbox"));
    await user.keyboard(" ");

    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does nothing while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Checkmark checked={false} label="Complete Buy milk" onChange={onChange} disabled />);

    await user.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stays usable while saving and exposes loading and error states", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkmark checked label="Complete Buy milk" onChange={onChange} state="loading" />,
    );

    const box = screen.getByRole("checkbox");
    expect(box).toHaveAttribute("aria-busy", "true");
    expect(box).toHaveAttribute("data-state", "loading");
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <Checkmark checked={false} label="Complete Buy milk" onChange={onChange} state="error" />,
    );
    expect(box).toHaveAttribute("data-state", "error");
    expect(box).not.toHaveAttribute("aria-busy");
  });

  it("plays the completion animation only when the user checks it", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <Checkmark checked label="Complete Buy milk" onChange={() => {}} />,
    );
    const box = screen.getByRole("checkbox");
    expect(box).not.toHaveAttribute("data-animating");

    rerender(<Checkmark checked={false} label="Complete Buy milk" onChange={() => {}} />);
    fireEvent.click(box);
    expect(box).toHaveAttribute("data-animating", "true");

    act(() => vi.advanceTimersByTime(COMPLETION_MS));
    expect(box).not.toHaveAttribute("data-animating");
    vi.useRealTimers();
  });

  it("does not animate when unchecking", () => {
    render(<Checkmark checked label="Complete Buy milk" onChange={() => {}} />);

    fireEvent.click(screen.getByRole("checkbox"));

    expect(screen.getByRole("checkbox")).not.toHaveAttribute("data-animating");
  });
});
