import { startOfDay } from "./orderTasks";

const DAY_MS = 24 * 60 * 60 * 1000;
const relativeNames: Record<number, string> = { [-1]: "Yesterday", 0: "Today", 1: "Tomorrow" };

/** A short due label: "Today", "Tomorrow, 15:00", "Mon 21 Sept", "Tue 5 Jan 2027". */
export function formatDue(date: Date, hasTime: boolean, now: Date, locale?: string) {
  // Round, not floor: a DST change makes one local day 23 or 25 hours long.
  const offset = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
  const dayLabel =
    relativeNames[offset] ??
    new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
    })
      .format(date)
      .replace(",", "");
  if (!hasTime) return dayLabel;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
  return `${dayLabel}, ${time}`;
}
