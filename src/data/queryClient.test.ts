import { focusManager, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient, isTransientError, listenForFocus } from "./queryClient";

describe("isTransientError", () => {
  it.each([
    ["a timeout", { message: "Timeout", status: 408 }, true],
    ["throttling", { message: "Too many requests", status: 429 }, true],
    ["a server error", { message: "Bad gateway", status: 502 }, true],
    ["a network failure", new TypeError("Failed to fetch"), true],
    ["a bad request", { message: "Bad request", status: 400 }, false],
    ["a permission error", { message: "Forbidden", status: 403 }, false],
    ["a missing record", { message: "Not found", status: 404 }, false],
    ["a plain error with no status", new Error("Task t1 not found"), false],
  ])("treats %s correctly", (_name, error, expected) => {
    expect(isTransientError(error)).toBe(expected);
  });
});

describe("createQueryClient", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    focusManager.setFocused(undefined);
  });

  function observe(queryFn: () => Promise<string>) {
    const client = createQueryClient();
    const observer = new QueryObserver(client, { queryKey: ["probe"], queryFn });
    const unsubscribe = observer.subscribe(() => {});
    return { client, unsubscribe };
  }

  it("refetches every 60 seconds while the page is visible", async () => {
    const queryFn = vi.fn(async () => "data");
    const { unsubscribe } = observe(queryFn);
    await vi.advanceTimersByTimeAsync(0);
    expect(queryFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(queryFn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(queryFn).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("does not poll while the page is hidden", async () => {
    const queryFn = vi.fn(async () => "data");
    const { unsubscribe } = observe(queryFn);
    await vi.advanceTimersByTimeAsync(0);

    focusManager.setFocused(false);
    await vi.advanceTimersByTimeAsync(180_000);

    expect(queryFn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("retries a transient failure but not a permanent one", async () => {
    let calls = 0;
    const flaky = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw Object.assign(new Error("Unavailable"), { status: 503 });
      return "data";
    });
    const { client, unsubscribe } = observe(flaky);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.getQueryData(["probe"])).toBe("data");
    unsubscribe();

    const denied = vi.fn(async () => {
      throw Object.assign(new Error("Forbidden"), { status: 403 });
    });
    const second = createQueryClient();
    const observer = new QueryObserver(second, { queryKey: ["denied"], queryFn: denied });
    const stop = observer.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(10_000);
    expect(denied).toHaveBeenCalledTimes(1);
    expect(observer.getCurrentResult().isError).toBe(true);
    stop();
  });

  it("does not retry writes, which may not be safe to repeat", async () => {
    const client = createQueryClient();
    const write = vi.fn(async () => {
      throw Object.assign(new Error("Unavailable"), { status: 503 });
    });

    const result = client
      .getMutationCache()
      .build(client, { mutationFn: write })
      .execute(undefined)
      .catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await result).toBeInstanceOf(Error);
    expect(write).toHaveBeenCalledTimes(1);
  });
});

describe("listenForFocus", () => {
  afterEach(() => focusManager.setFocused(undefined));

  it("reports focus when the window gains focus, not only when the tab becomes visible", () => {
    const onFocus = vi.fn();
    const cleanup = listenForFocus(onFocus);

    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));

    expect(onFocus).toHaveBeenCalledTimes(2);
    cleanup?.();
    window.dispatchEvent(new Event("focus"));
    expect(onFocus).toHaveBeenCalledTimes(2);
  });
});
