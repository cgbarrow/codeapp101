import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router";
import { queryKeys } from "@/data/keys";
import type { Task } from "@/data/repo";
import { createFiredStore, startReminderScheduler } from "@/features/reminders/scheduler";
import { formatDue } from "@/features/tasks/formatDue";

export type NotificationPermissionState = NotificationPermission | "unsupported";

/** Location state asking the list route to open one task's detail panel. */
export type OpenTaskState = { openTaskId: string };

const listeners = new Set<() => void>();

function readPermission(): NotificationPermissionState {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // The user can change the permission in browser settings while the tab is in the background.
  window.addEventListener("focus", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", listener);
  };
}

/**
 * Asks for notification permission if the user has not decided yet. Call it from a user action,
 * such as setting a reminder: browsers ignore or penalise requests made on page load. Never
 * throws; inside some embedding frames the request is refused outright.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (readPermission() === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      // Treated as undecided; the status row still offers to try again.
    }
    listeners.forEach((listener) => listener());
  }
  return readPermission();
}

/** The browser's notification permission, shared by every component that shows or requests it. */
export function useNotificationPermission() {
  const permission = useSyncExternalStore(subscribe, readPermission, () => "unsupported" as const);
  return { permission, request: requestNotificationPermission };
}

/**
 * Shows browser notifications for reminders while the app is open, reading tasks from the query
 * cache. Clicking a notification focuses the tab and opens the task. Mount once, near the root.
 */
export function useReminders() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    function cachedTasks(): Task[] {
      if (readPermission() !== "granted") return [];
      return queryClient
        .getQueriesData<Task[]>({ queryKey: queryKeys.tasks })
        .flatMap(([, data]) => data ?? []);
    }

    function notify(task: Task) {
      try {
        const notification = new Notification(task.title, {
          body: task.dueDate ? formatDue(task.dueDate, task.hasTime, new Date()) : undefined,
          tag: task.id,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
          navigateRef.current(`/list/${task.listId}`, {
            state: { openTaskId: task.id } satisfies OpenTaskState,
          });
        };
      } catch {
        // Some browsers, such as Chrome on Android, only allow notifications from a service worker.
      }
    }

    return startReminderScheduler({ getTasks: cachedTasks, notify, fired: createFiredStore() });
  }, [queryClient]);
}
