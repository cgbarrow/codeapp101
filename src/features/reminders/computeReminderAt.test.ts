import { describe, expect, it } from "vitest";
import { computeReminderAt, reminderOffsetOf } from "./computeReminderAt";

const timed = new Date(2026, 8, 18, 15, 0);
const dateOnly = new Date(2026, 8, 18);

describe("computeReminderAt", () => {
  it.each([
    ["at-time", new Date(2026, 8, 18, 15, 0)],
    ["10m", new Date(2026, 8, 18, 14, 50)],
    ["1h", new Date(2026, 8, 18, 14, 0)],
    ["1d", new Date(2026, 8, 17, 15, 0)],
  ] as const)("offsets a timed task: %s", (offset, expected) => {
    expect(computeReminderAt(timed, true, offset)).toEqual(expected);
  });

  it("reminds about a date-only task at 9:00 on its day", () => {
    expect(computeReminderAt(dateOnly, false, "at-time")).toEqual(new Date(2026, 8, 18, 9, 0));
    expect(computeReminderAt(dateOnly, false, "1h")).toEqual(new Date(2026, 8, 18, 8, 0));
    expect(computeReminderAt(dateOnly, false, "1d")).toEqual(new Date(2026, 8, 17, 9, 0));
  });

  it("returns null with no offset or no due date", () => {
    expect(computeReminderAt(timed, true, "none")).toBeNull();
    expect(computeReminderAt(null, false, "1h")).toBeNull();
  });

  it("keeps the wall-clock time for one day before across a DST change", () => {
    // Tests run in America/Toronto (vitest.config.ts): clocks change on 8 March and 1 November 2026.
    const afterSpringForward = new Date(2026, 2, 8, 15, 0);
    const afterFallBack = new Date(2026, 10, 1, 15, 0);

    expect(computeReminderAt(afterSpringForward, true, "1d")).toEqual(new Date(2026, 2, 7, 15, 0));
    expect(computeReminderAt(afterFallBack, true, "1d")).toEqual(new Date(2026, 9, 31, 15, 0));
  });
});

describe("reminderOffsetOf", () => {
  it("recognises each preset from a stored reminder time", () => {
    for (const offset of ["at-time", "10m", "1h", "1d"] as const) {
      const reminderAt = computeReminderAt(timed, true, offset);
      expect(reminderOffsetOf({ dueDate: timed, hasTime: true, reminderAt })).toBe(offset);
    }
  });

  it("is none without a reminder and custom for anything else", () => {
    expect(reminderOffsetOf({ dueDate: timed, hasTime: true, reminderAt: null })).toBe("none");
    expect(
      reminderOffsetOf({
        dueDate: timed,
        hasTime: true,
        reminderAt: new Date(2026, 8, 18, 14, 50, 30),
      }),
    ).toBe("custom");
    expect(
      reminderOffsetOf({ dueDate: null, hasTime: false, reminderAt: new Date(2026, 8, 18) }),
    ).toBe("custom");
  });
});
