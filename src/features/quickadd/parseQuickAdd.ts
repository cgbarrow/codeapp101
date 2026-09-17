import * as chrono from "chrono-node";
import type { Recurrence } from "@/data/repo";

export type QuickAddParse = {
  title: string;
  dueDate: Date | null;
  hasTime: boolean;
  recurrence: Recurrence;
};

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const WEEKDAY_PATTERN =
  "sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?";

/** "every day|week|month|<weekday>". Bare "daily" or "weekly" is too often part of a title. */
const RECURRENCE = new RegExp(`\\s*\\bevery\\s+(day|week|month|${WEEKDAY_PATTERN})\\b`, "i");

/** Words that link a date to a title and should go with the date: "Report due Sep 30". */
const TRAILING_CONNECTOR = /\s*\b(?:on|at|by|due|for)\s*$/i;

/** Weekday abbreviations that are also common words: "Sat down with the team". */
const AMBIGUOUS_WORDS = /^(?:sat|sun)$/i;

function atMidnight(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function nextWeekday(from: Date, weekday: number) {
  const day = atMidnight(from);
  day.setDate(day.getDate() + ((weekday - day.getDay() + 7) % 7));
  return day;
}

function tidy(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,.;:–-]+|[\s,;:–-]+$/g, "")
    .trim();
}

/**
 * Rejects chrono matches that are words in the title, not dates: "Now", "2 hours", a bare month
 * name ("Book flight for march"), or "Sat" meaning sat.
 */
function isUsable(result: chrono.ParsedResult) {
  const { start, text } = result;
  const tags = result.tags();
  if (tags.has("casualReference/now")) return false;
  if (AMBIGUOUS_WORDS.test(text.trim())) return false;
  if (tags.has("result/relativeDate") && /^\d/.test(text.trim())) return false;
  return start.isCertain("day") || start.isCertain("weekday") || start.isCertain("hour");
}

/** Reads a bare hour from 1 to 7 ("Call mom at 5") as afternoon, as people mean it. */
function resolveTime(result: chrono.ParsedResult, now: Date) {
  const { start } = result;
  let hour = start.get("hour") ?? 0;
  if (!start.isCertain("meridiem") && hour >= 1 && hour <= 7) hour += 12;
  const date = start.date();
  date.setHours(hour, start.get("minute") ?? 0, 0, 0);
  // A time with no day means the next time it comes round.
  if (!start.isCertain("day") && !start.isCertain("weekday")) {
    date.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    if (date.getTime() < now.getTime()) date.setDate(date.getDate() + 1);
  }
  return date;
}

/**
 * Splits quick-add text into a title, a due date and a recurrence. Parsing is deliberately
 * conservative: when in doubt the words stay in the title, and the user can add a date later.
 */
export function parseQuickAdd(text: string, now: Date): QuickAddParse {
  const original = tidy(text);
  let remaining = original;
  let recurrence: Recurrence = "none";
  let recurringDay: Date | null = null;

  const repeat = RECURRENCE.exec(remaining);
  if (repeat) {
    const unit = repeat[1].toLowerCase();
    if (unit === "day") recurrence = "daily";
    else if (unit === "month") recurrence = "monthly";
    else {
      recurrence = "weekly";
      if (unit !== "week") recurringDay = nextWeekday(now, WEEKDAYS.indexOf(unit.slice(0, 3)));
    }
    remaining = remaining.slice(0, repeat.index) + remaining.slice(repeat.index + repeat[0].length);
  }

  const result = chrono.en.casual
    .parse(remaining, now, { forwardDate: true })
    .find((candidate) => isUsable(candidate));

  let title = remaining;
  let dueDate: Date | null = null;
  let hasTime = false;

  if (result) {
    const before = remaining.slice(0, result.index).replace(TRAILING_CONNECTOR, "");
    title = `${before} ${remaining.slice(result.index + result.text.length)}`;
    hasTime = result.start.isCertain("hour");
    dueDate = hasTime ? resolveTime(result, now) : atMidnight(result.start.date());
    if (recurringDay && !result.start.isCertain("day") && !result.start.isCertain("weekday")) {
      dueDate.setFullYear(
        recurringDay.getFullYear(),
        recurringDay.getMonth(),
        recurringDay.getDate(),
      );
    }
  } else if (recurrence !== "none") {
    dueDate = recurringDay ?? atMidnight(now);
  }

  title = tidy(title);
  if (!title) return { title: original, dueDate: null, hasTime: false, recurrence: "none" };
  return { title, dueDate, hasTime, recurrence };
}
