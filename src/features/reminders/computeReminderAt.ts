import type { Task } from "@/data/repo";

export type ReminderOffset = "none" | "at-time" | "10m" | "1h" | "1d";

export const REMINDER_OFFSETS: ReadonlyArray<{ value: ReminderOffset; label: string }> = [
  { value: "none", label: "None" },
  { value: "at-time", label: "At time of task" },
  { value: "10m", label: "10 minutes before" },
  { value: "1h", label: "1 hour before" },
  { value: "1d", label: "1 day before" },
];

/** A task with a date but no time is reminded about at this hour on its day. */
export const DATE_ONLY_REMINDER_HOUR = 9;

const MINUTE_MS = 60_000;

/** When to remind about a task due at `dueDate`, or `null` for no reminder. */
export function computeReminderAt(
  dueDate: Date | null,
  hasTime: boolean,
  offset: ReminderOffset,
): Date | null {
  if (offset === "none" || dueDate === null) return null;
  const at = new Date(dueDate);
  if (!hasTime) at.setHours(DATE_ONLY_REMINDER_HOUR, 0, 0, 0);
  switch (offset) {
    case "at-time":
      return at;
    case "10m":
      return new Date(at.getTime() - 10 * MINUTE_MS);
    case "1h":
      return new Date(at.getTime() - 60 * MINUTE_MS);
    case "1d":
      // A calendar day, not 24 hours, so the reminder keeps its clock time across DST.
      at.setDate(at.getDate() - 1);
      return at;
  }
}

/** Which preset produced a task's stored reminder time; "custom" if none of them did. */
export function reminderOffsetOf(
  task: Pick<Task, "dueDate" | "hasTime" | "reminderAt">,
): ReminderOffset | "custom" {
  if (task.reminderAt === null) return "none";
  const match = REMINDER_OFFSETS.find(
    ({ value }) =>
      value !== "none" &&
      computeReminderAt(task.dueDate, task.hasTime, value)?.getTime() ===
        task.reminderAt!.getTime(),
  );
  return match?.value ?? "custom";
}
