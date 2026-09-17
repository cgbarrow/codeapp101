import { useId } from "react";
import { useNotificationPermission } from "@/hooks/useNotifications";
import styles from "./ReminderStatus.module.css";

const MESSAGES = {
  granted: "Reminders are on while this tab is open.",
  default: "Reminders are off.",
  denied: "Reminders are blocked. Allow notifications for this site in your browser settings.",
  unsupported: "This browser can't show reminders.",
} as const;

/** The settings row for browser notifications: what they will do, and a way to turn them on. */
export function ReminderStatus() {
  const { permission, request } = useNotificationPermission();
  const labelId = useId();

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className={styles.status}
      data-permission={permission}
    >
      <span id={labelId} className={styles.label}>
        Reminders
      </span>
      <p className={styles.message} aria-live="polite">
        {MESSAGES[permission]}
      </p>
      {permission === "default" && (
        <button type="button" className={styles.button} onClick={() => void request()}>
          Turn on reminders
        </button>
      )}
    </div>
  );
}
