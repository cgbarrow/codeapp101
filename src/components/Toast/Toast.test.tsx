import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./ToastProvider";
import { useToast, type ToastApi, type ToastInput } from "./useToast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

let api: ToastApi;

function Capture({ onApi }: { onApi: (value: ToastApi) => void }) {
  const value = useToast();
  useEffect(() => onApi(value), [value, onApi]);
  return null;
}

const captureApi = (value: ToastApi) => {
  api = value;
};

function renderToasts() {
  return render(
    <ToastProvider>
      <Capture onApi={captureApi} />
    </ToastProvider>,
  );
}

function show(input: ToastInput) {
  let id = "";
  act(() => {
    id = api.show(input);
  });
  return id;
}

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe("Toast", () => {
  it("announces a message politely and removes it after its duration", () => {
    renderToasts();

    show({ message: "Completed Buy milk", durationMs: 3000 });

    const region = screen.getByRole("region", { name: "Notifications" });
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Completed Buy milk");
    advance(2999);
    expect(region).toHaveTextContent("Completed Buy milk");
    advance(1);
    expect(region).not.toHaveTextContent("Completed Buy milk");
  });

  it("runs the action once and dismisses the toast", () => {
    renderToasts();
    const onAction = vi.fn();

    show({ message: "Completed Buy milk", action: { label: "Undo", onAction } });
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Completed Buy milk")).not.toBeInTheDocument();
  });

  it("keeps an error until it is dismissed and announces it assertively", () => {
    renderToasts();

    show({ message: "Couldn't complete Buy milk.", tone: "error" });
    advance(60_000);

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't complete Buy milk.");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("pauses the countdown while the pointer or focus is on the toast", () => {
    renderToasts();

    show({
      message: "Completed Buy milk",
      durationMs: 3000,
      action: { label: "Undo", onAction() {} },
    });
    const toast = screen.getByText("Completed Buy milk").closest("li")!;
    advance(2000);
    fireEvent.mouseEnter(toast);
    advance(10_000);
    expect(toast).toBeInTheDocument();
    fireEvent.mouseLeave(toast);
    fireEvent.focus(screen.getByRole("button", { name: "Undo" }));
    advance(10_000);
    expect(toast).toBeInTheDocument();
    fireEvent.blur(screen.getByRole("button", { name: "Undo" }));
    advance(999);
    expect(toast).toBeInTheDocument();
    advance(1);

    expect(screen.queryByText("Completed Buy milk")).not.toBeInTheDocument();
  });

  it("shows at most three toasts, dropping the oldest", () => {
    renderToasts();

    for (const n of [1, 2, 3, 4]) show({ message: `Toast ${n}` });

    expect(screen.queryByText("Toast 1")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("can be dismissed by id", () => {
    renderToasts();

    const id = show({ message: "Completed Buy milk" });
    act(() => api.dismiss(id));

    expect(screen.queryByText("Completed Buy milk")).not.toBeInTheDocument();
  });

  it("throws a clear error outside the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used inside ToastProvider",
    );
  });
});
