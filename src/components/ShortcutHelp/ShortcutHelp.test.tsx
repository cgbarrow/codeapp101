import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ShortcutHelp } from "./ShortcutHelp";

function renderHelp() {
  return render(
    <>
      <input aria-label="Elsewhere" />
      <ShortcutHelp />
    </>,
  );
}

describe("ShortcutHelp", () => {
  it("opens with ? and lists every shortcut", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.keyboard("?");

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    const rows = within(dialog).getAllByRole("row");
    const text = rows.map((row) => row.textContent);
    for (const expected of [
      "nNew task",
      "jNext task",
      "kPrevious task",
      "xComplete or reopen",
      "eEdit",
      "⌫Delete",
      "1–9Switch list",
      "tToday",
      "?Show shortcuts",
      "EscClose",
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("opens from its button and closes from its close button, returning focus", async () => {
    const user = userEvent.setup();
    renderHelp();
    const trigger = screen.getByRole("button", { name: "Keyboard shortcuts" });

    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape and toggles with ?", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.keyboard("?");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.keyboard("?");
    await user.keyboard("?");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to where it was before ? opened it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Task title</button>
        <ShortcutHelp />
      </>,
    );
    const title = screen.getByRole("button", { name: "Task title" });
    title.focus();

    await user.keyboard("?");
    await user.keyboard("{Escape}");

    expect(title).toHaveFocus();
  });

  it("closes the native dialog before moving focus, which a modal would otherwise block", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    let openWhenFocused: boolean | null = null;
    screen
      .getByRole("button", { name: "Keyboard shortcuts" })
      .addEventListener("focus", () => (openWhenFocused = dialog.open));
    await user.keyboard("{Escape}");

    expect(openWhenFocused).toBe(false);
  });

  it("ignores ? while typing", async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.click(screen.getByRole("textbox", { name: "Elsewhere" }));
    await user.keyboard("?");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
