import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listDefaults } from "@/data/defaults";
import type { List } from "@/data/repo";
import { landingPath, readLastView, saveLastView } from "./lastView";

const work: List = { ...listDefaults, id: "work", name: "Work" };

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("saveLastView and readLastView", () => {
  it.each(["/today", "/completed", "/list/work"])("remembers %s", (path) => {
    saveLastView(path);

    expect(readLastView()).toBe(path);
  });

  it("ignores paths that are not views", () => {
    saveLastView("/list/work");
    saveLastView("/nowhere");

    expect(readLastView()).toBe("/list/work");
  });

  it("reads nothing when storage is empty or unavailable", () => {
    expect(readLastView()).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    expect(() => saveLastView("/today")).not.toThrow();
    expect(readLastView()).toBeNull();
  });
});

describe("landingPath", () => {
  it("lands on Today when nothing is remembered", () => {
    expect(landingPath(null, [work])).toBe("/today");
  });

  it("returns to the remembered view", () => {
    expect(landingPath("/completed", [work])).toBe("/completed");
    expect(landingPath("/list/work", [work])).toBe("/list/work");
  });

  it("lands on Today when the remembered list no longer exists", () => {
    expect(landingPath("/list/deleted", [work])).toBe("/today");
  });
});
