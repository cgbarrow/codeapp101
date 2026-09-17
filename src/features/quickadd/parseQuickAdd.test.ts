import { describe, expect, it } from "vitest";
import type { Recurrence } from "@/data/repo";
import { parseQuickAdd } from "./parseQuickAdd";

/** Thursday 17 September 2026, 09:30 local time. */
const now = new Date(2026, 8, 17, 9, 30);

type Expected = {
  title: string;
  /** [month (1-12), day] for a date-only task, [month, day, hour, minute] for a timed one. */
  due: [number, number] | [number, number, number, number] | null;
  recurrence?: Recurrence;
  year?: number;
};

const cases: Array<[string, Expected]> = [
  // Weekdays and relative days
  ["Buy milk on Friday", { title: "Buy milk", due: [9, 18] }],
  ["Submit report due friday", { title: "Submit report", due: [9, 18] }],
  ["Buy milk today", { title: "Buy milk", due: [9, 17] }],
  ["Fix bug by tomorrow", { title: "Fix bug", due: [9, 18] }],
  ["Plan trip next week", { title: "Plan trip", due: [9, 24] }],
  ["Dentist in 3 days", { title: "Dentist", due: [9, 20] }],
  ["Clean garage this weekend", { title: "Clean garage", due: [9, 19] }],
  ["Tonight: pack bags", { title: "pack bags", due: [9, 17] }],
  // Explicit dates
  ["Pay rent 30/9", { title: "Pay rent", due: [9, 30] }],
  ["Pay rent 9/30", { title: "Pay rent", due: [9, 30] }],
  ["Report due Sep 30", { title: "Report", due: [9, 30] }],
  ["Launch on 5 October", { title: "Launch", due: [10, 5] }],
  ["Mar 3 dentist", { title: "dentist", due: [3, 3], year: 2027 }],
  ["12/25 buy gifts", { title: "buy gifts", due: [12, 25] }],
  // Times
  ["Call Sam tomorrow 3pm", { title: "Call Sam", due: [9, 18, 15, 0] }],
  ["Standup at 3pm", { title: "Standup", due: [9, 17, 15, 0] }],
  ["Call mom at 5", { title: "Call mom", due: [9, 17, 17, 0] }],
  ["Run at 8", { title: "Run", due: [9, 18, 8, 0] }],
  ["Pick up parcel at noon", { title: "Pick up parcel", due: [9, 17, 12, 0] }],
  ["Meet Sam next Tuesday at 10:30am", { title: "Meet Sam", due: [9, 22, 10, 30] }],
  ["Call Sam tomorrow at 3pm, re budget", { title: "Call Sam, re budget", due: [9, 18, 15, 0] }],
  // Recurrence
  ["Water plants every Monday", { title: "Water plants", due: [9, 21], recurrence: "weekly" }],
  ["Stand-up every Thursday", { title: "Stand-up", due: [9, 17], recurrence: "weekly" }],
  ["Team sync every mon at 9am", { title: "Team sync", due: [9, 21, 9, 0], recurrence: "weekly" }],
  ["Water plants every day", { title: "Water plants", due: [9, 17], recurrence: "daily" }],
  ["Pay rent every month", { title: "Pay rent", due: [9, 17], recurrence: "monthly" }],
  ["Gym every week at 7am", { title: "Gym", due: [9, 18, 7, 0], recurrence: "weekly" }],
  // Negatives: no date, title untouched
  ["Email May about Q3", { title: "Email May about Q3", due: null }],
  ["Buy 2 milks", { title: "Buy 2 milks", due: null }],
  ["Book flight for march", { title: "Book flight for march", due: null }],
  ["Now that is done", { title: "Now that is done", due: null }],
  ["2 hours of focus", { title: "2 hours of focus", due: null }],
  ["Review Q3 report", { title: "Review Q3 report", due: null }],
  ["Write weekly report", { title: "Write weekly report", due: null }],
  ["Sat down with the team", { title: "Sat down with the team", due: null }],
  ["Read chapter 3", { title: "Read chapter 3", due: null }],
  ["tomorrow", { title: "tomorrow", due: null }],
  ["  Buy milk  ", { title: "Buy milk", due: null }],
];

describe("parseQuickAdd", () => {
  it("covers at least thirty phrases", () => {
    expect(cases.length).toBeGreaterThanOrEqual(30);
  });

  it.each(cases)("%j", (text, expected) => {
    const result = parseQuickAdd(text, now);

    expect(result.title).toBe(expected.title);
    expect(result.recurrence).toBe(expected.recurrence ?? "none");
    if (expected.due === null) {
      expect(result.dueDate).toBeNull();
      expect(result.hasTime).toBe(false);
      return;
    }
    const [month, day, hour = 0, minute = 0] = expected.due;
    expect(result.dueDate).toEqual(new Date(expected.year ?? 2026, month - 1, day, hour, minute));
    expect(result.hasTime).toBe(expected.due.length === 4);
  });

  it("returns an empty title for blank input", () => {
    expect(parseQuickAdd("   ", now)).toEqual({
      title: "",
      dueDate: null,
      hasTime: false,
      recurrence: "none",
    });
  });
});
