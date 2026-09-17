import { describe, expect, it } from "vitest";
import { formatDue } from "./formatDue";

const now = new Date(2026, 8, 17, 9, 30);
const day = (offset: number, h = 0, m = 0) => new Date(2026, 8, 17 + offset, h, m);

describe("formatDue", () => {
  it.each([
    [day(0), "Today"],
    [day(1), "Tomorrow"],
    [day(-1), "Yesterday"],
  ])("names nearby days: %s", (date, expected) => {
    expect(formatDue(date, false, now, "en-GB")).toBe(expected);
  });

  it("uses weekday, day and month for other dates", () => {
    expect(formatDue(day(4), false, now, "en-GB")).toBe("Mon 21 Sept");
  });

  it("adds the year for dates outside the current year", () => {
    expect(formatDue(new Date(2027, 0, 5), false, now, "en-GB")).toBe("Tue 5 Jan 2027");
  });

  it("appends the time when the task has one", () => {
    expect(formatDue(day(0, 15, 0), true, now, "en-GB")).toBe("Today, 15:00");
    expect(formatDue(day(1, 8, 5), true, now, "en-US")).toBe("Tomorrow, 8:05 AM");
  });
});
