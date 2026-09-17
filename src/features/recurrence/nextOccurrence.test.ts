import { describe, expect, it } from "vitest";
import { anchorDayOf, nextOccurrence } from "./nextOccurrence";

// Tests run in America/Toronto (vitest.config.ts). In 2026 clocks go forward on 8 March and back
// on 1 November.

describe("nextOccurrence", () => {
  it("returns null for a task that does not repeat", () => {
    expect(nextOccurrence(new Date(2026, 8, 17), "none")).toBeNull();
  });

  it("adds a calendar day for daily, keeping the clock time across a DST change", () => {
    expect(nextOccurrence(new Date(2026, 2, 7, 9, 0), "daily")).toEqual(new Date(2026, 2, 8, 9, 0));
    expect(nextOccurrence(new Date(2026, 9, 31, 23, 30), "daily")).toEqual(
      new Date(2026, 10, 1, 23, 30),
    );
  });

  it("keeps the weekday for weekly, across a DST change and a month end", () => {
    const thursday = new Date(2026, 9, 29, 15, 0);
    const next = nextOccurrence(thursday, "weekly")!;

    expect(next).toEqual(new Date(2026, 10, 5, 15, 0));
    expect(next.getDay()).toBe(thursday.getDay());
  });

  it("clamps monthly to the month end, then returns to the original day", () => {
    const jan31 = new Date(2026, 0, 31, 8, 0);

    const feb = nextOccurrence(jan31, "monthly")!;
    expect(feb).toEqual(new Date(2026, 1, 28, 8, 0));

    expect(nextOccurrence(feb, "monthly", 31)).toEqual(new Date(2026, 2, 31, 8, 0));
  });

  it("uses 29 February in a leap year", () => {
    expect(nextOccurrence(new Date(2028, 0, 31), "monthly")).toEqual(new Date(2028, 1, 29));
  });

  it("rolls monthly over into the next year", () => {
    expect(nextOccurrence(new Date(2026, 11, 15), "monthly")).toEqual(new Date(2027, 0, 15));
  });

  it("clamps to 30 days where the month is shorter", () => {
    expect(nextOccurrence(new Date(2026, 2, 31), "monthly")).toEqual(new Date(2026, 3, 30));
  });
});

describe("anchorDayOf", () => {
  type Instance = { id: string; dueDate: Date | null; recurrenceParentId: string | null };
  const lookup = (instances: Instance[]) => (id: string) => instances.find((t) => t.id === id);

  it("is the due date's own day when the task has no parent", () => {
    const task = { id: "a", dueDate: new Date(2026, 1, 28), recurrenceParentId: null };

    expect(anchorDayOf(task, lookup([task]))).toBe(28);
  });

  it("follows a clamped date back to the day it was clamped from", () => {
    const jan = { id: "jan", dueDate: new Date(2026, 0, 31), recurrenceParentId: null };
    const feb = { id: "feb", dueDate: new Date(2026, 1, 28), recurrenceParentId: "jan" };
    const mar = { id: "mar", dueDate: new Date(2026, 2, 31), recurrenceParentId: "feb" };
    const apr = { id: "apr", dueDate: new Date(2026, 3, 30), recurrenceParentId: "mar" };
    const find = lookup([jan, feb, mar, apr]);

    expect(anchorDayOf(feb, find)).toBe(31);
    expect(anchorDayOf(apr, find)).toBe(31);
  });

  it("keeps a month-end day that was not clamped", () => {
    const jan = { id: "jan", dueDate: new Date(2026, 0, 28), recurrenceParentId: null };
    const feb = { id: "feb", dueDate: new Date(2026, 1, 28), recurrenceParentId: "jan" };

    expect(anchorDayOf(feb, lookup([jan, feb]))).toBe(28);
  });

  it("respects a due date the user moved away from the month end", () => {
    const jan = { id: "jan", dueDate: new Date(2026, 0, 31), recurrenceParentId: null };
    const feb = { id: "feb", dueDate: new Date(2026, 1, 14), recurrenceParentId: "jan" };

    expect(anchorDayOf(feb, lookup([jan, feb]))).toBe(14);
  });

  it("falls back to the task's own day when the parent is gone", () => {
    const feb = { id: "feb", dueDate: new Date(2026, 1, 28), recurrenceParentId: "deleted" };

    expect(anchorDayOf(feb, lookup([feb]))).toBe(28);
  });
});
