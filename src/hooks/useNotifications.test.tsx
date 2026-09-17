import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { taskDefaults } from "@/data/defaults";
import { queryKeys } from "@/data/keys";
import { createMockRepos } from "@/data/mock/mockRepos";
import type { Task } from "@/data/repo";
import { REMINDER_CHECK_MS } from "@/features/reminders/scheduler";
import { createTestQueryClient, createWrapper } from "@/test/renderWithProviders";
import { useNotificationPermission, useReminders } from "./useNotifications";

class FakeNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn(async () => {
    FakeNotification.permission = FakeNotification.nextAnswer;
    return FakeNotification.permission;
  });
  static nextAnswer: NotificationPermission = "granted";
  static shown: FakeNotification[] = [];

  onclick: (() => void) | null = null;
  close = vi.fn();

  title: string;
  options: NotificationOptions;

  constructor(title: string, options: NotificationOptions) {
    this.title = title;
    this.options = options;
    FakeNotification.shown.push(this);
  }
}

beforeEach(() => {
  FakeNotification.permission = "default";
  FakeNotification.nextAnswer = "granted";
  FakeNotification.shown = [];
  FakeNotification.requestPermission.mockClear();
  vi.stubGlobal("Notification", FakeNotification);
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useNotificationPermission", () => {
  it("reports the browser's permission", () => {
    FakeNotification.permission = "denied";

    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("denied");
  });

  it("reports unsupported when the browser has no Notification API", () => {
    vi.stubGlobal("Notification", undefined);

    const { result } = renderHook(() => useNotificationPermission());

    expect(result.current.permission).toBe("unsupported");
  });

  it("asks once when undecided and updates every consumer with the answer", async () => {
    const first = renderHook(() => useNotificationPermission());
    const second = renderHook(() => useNotificationPermission());

    await act(() => first.result.current.request());
    await act(() => first.result.current.request());

    expect(FakeNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(second.result.current.permission).toBe("granted");
  });

  it("does not ask when permission was already refused", async () => {
    FakeNotification.permission = "denied";
    const { result } = renderHook(() => useNotificationPermission());

    await act(() => result.current.request());

    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("survives a browser whose request throws", async () => {
    FakeNotification.requestPermission.mockRejectedValueOnce(new Error("blocked in iframe"));
    const { result } = renderHook(() => useNotificationPermission());

    await act(() => result.current.request());

    expect(result.current.permission).toBe("default");
  });
});

describe("useReminders", () => {
  const opened = new Date(2026, 8, 17, 9, 0, 0);
  const call: Task = {
    ...taskDefaults,
    id: "t3",
    listId: "work",
    title: "Call Sam about the offsite",
    dueDate: new Date(2026, 8, 17, 15, 0),
    hasTime: true,
    reminderAt: new Date(2026, 8, 17, 9, 0, 45),
  };

  function Where() {
    const location = useLocation();
    return (
      <p data-testid="where">
        {location.pathname} {(location.state as { openTaskId?: string } | null)?.openTaskId}
      </p>
    );
  }

  function Harness({ children }: { children?: ReactNode }) {
    useReminders();
    return (
      <>
        <Where />
        {children}
      </>
    );
  }

  function renderReminders() {
    vi.useFakeTimers();
    vi.setSystemTime(opened);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.tasksByList("work"), [call]);
    const Providers = createWrapper(createMockRepos(), queryClient);
    render(
      <Providers>
        <MemoryRouter initialEntries={["/list/inbox"]}>
          <Routes>
            <Route path="*" element={<Harness />} />
          </Routes>
        </MemoryRouter>
      </Providers>,
    );
    return { queryClient };
  }

  it("shows a notification for a cached task when its reminder comes due", () => {
    FakeNotification.permission = "granted";
    renderReminders();

    act(() => vi.advanceTimersByTime(REMINDER_CHECK_MS));
    expect(FakeNotification.shown).toHaveLength(0);

    act(() => vi.advanceTimersByTime(REMINDER_CHECK_MS));
    expect(FakeNotification.shown).toHaveLength(1);
    expect(FakeNotification.shown[0].title).toBe("Call Sam about the offsite");
    expect(FakeNotification.shown[0].options).toMatchObject({ body: "Today, 3:00 PM", tag: "t3" });
  });

  it("focuses the tab and opens the task when the notification is clicked", () => {
    FakeNotification.permission = "granted";
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    renderReminders();
    act(() => vi.advanceTimersByTime(2 * REMINDER_CHECK_MS));

    act(() => FakeNotification.shown[0].onclick?.());

    expect(focus).toHaveBeenCalled();
    expect(FakeNotification.shown[0].close).toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/list/work t3");
  });

  it("shows nothing, and throws nothing, without permission", () => {
    FakeNotification.permission = "denied";
    renderReminders();

    act(() => vi.advanceTimersByTime(4 * REMINDER_CHECK_MS));

    expect(FakeNotification.shown).toHaveLength(0);
  });

  it("shows nothing, and throws nothing, when the browser has no Notification API", () => {
    vi.stubGlobal("Notification", undefined);

    expect(() => {
      renderReminders();
      act(() => vi.advanceTimersByTime(4 * REMINDER_CHECK_MS));
    }).not.toThrow();
  });

  it("fires a reminder that came due while permission was pending once it is granted", () => {
    renderReminders();
    act(() => vi.advanceTimersByTime(2 * REMINDER_CHECK_MS));
    expect(FakeNotification.shown).toHaveLength(0);

    FakeNotification.permission = "granted";
    act(() => vi.advanceTimersByTime(REMINDER_CHECK_MS));

    expect(FakeNotification.shown).toHaveLength(1);
  });
});
