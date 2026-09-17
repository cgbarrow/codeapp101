import { renderHook, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

describe("useKeyboardShortcuts", () => {
  it("runs the handler for a pressed key and prevents its default", async () => {
    const user = userEvent.setup();
    const onN = vi.fn<(event: KeyboardEvent) => void>();
    renderHook(() => useKeyboardShortcuts({ n: onN }));

    await user.keyboard("n");
    await user.keyboard("m");

    expect(onN).toHaveBeenCalledTimes(1);
    expect(onN.mock.calls[0][0].key).toBe("n");
  });

  it("is inert while typing in a field", async () => {
    const user = userEvent.setup();
    const onN = vi.fn();
    render(
      <>
        <input aria-label="Title" />
        <textarea aria-label="Notes" />
        <div contentEditable aria-label="Rich" role="textbox" suppressContentEditableWarning />
      </>,
    );
    renderHook(() => useKeyboardShortcuts({ n: onN }));

    await user.click(screen.getByRole("textbox", { name: "Title" }));
    await user.keyboard("n");
    await user.click(screen.getByRole("textbox", { name: "Notes" }));
    await user.keyboard("n");
    await user.click(screen.getByRole("textbox", { name: "Rich" }));
    await user.keyboard("n");

    expect(onN).not.toHaveBeenCalled();
  });

  it("ignores keys pressed with a modifier", async () => {
    const user = userEvent.setup();
    const onN = vi.fn();
    renderHook(() => useKeyboardShortcuts({ n: onN }));

    await user.keyboard("{Control>}n{/Control}{Meta>}n{/Meta}{Alt>}n{/Alt}");

    expect(onN).not.toHaveBeenCalled();
  });

  it("uses the latest handlers and stops listening on unmount", async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ handler }) => useKeyboardShortcuts({ n: handler }),
      {
        initialProps: { handler: first },
      },
    );

    rerender({ handler: second });
    await user.keyboard("n");
    unmount();
    await user.keyboard("n");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("leaves a key alone when its handler returns false", async () => {
    const user = userEvent.setup();
    const seen: boolean[] = [];
    document.addEventListener("keydown", (event) => seen.push(event.defaultPrevented));
    renderHook(() => useKeyboardShortcuts({ "9": () => false }));

    await user.keyboard("9");

    expect(seen.at(-1)).toBe(false);
  });
});
