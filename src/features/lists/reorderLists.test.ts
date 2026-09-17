import { describe, expect, it } from "vitest";
import type { List } from "@/data/repo";
import { reorderLists } from "./reorderLists";

function list(id: string, sortOrder: number): List {
  return { id, name: id, sortOrder, isInbox: false, isArchived: false };
}

describe("reorderLists", () => {
  it("moves a list down and renumbers the lists in their new order", () => {
    const lists = [list("a", 0), list("b", 1), list("c", 2)];

    const { ordered } = reorderLists(lists, 0, 2);

    expect(ordered.map((l) => [l.id, l.sortOrder])).toEqual([
      ["b", 0],
      ["c", 1],
      ["a", 2],
    ]);
  });

  it("moves a list up", () => {
    const lists = [list("a", 0), list("b", 1), list("c", 2)];

    const { ordered } = reorderLists(lists, 2, 1);

    expect(ordered.map((l) => l.id)).toEqual(["a", "c", "b"]);
  });

  it("reports only the lists whose sort order changed", () => {
    const lists = [list("a", 0), list("b", 1), list("c", 2), list("d", 3)];

    const { changes } = reorderLists(lists, 1, 2);

    expect(changes).toEqual([
      { id: "c", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ]);
  });

  it("repairs gaps and duplicates in existing sort orders", () => {
    const lists = [list("a", 5), list("b", 5), list("c", 9)];

    const { changes } = reorderLists(lists, 0, 0);

    expect(changes).toEqual([
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 1 },
      { id: "c", sortOrder: 2 },
    ]);
  });

  it("clamps a target index outside the array", () => {
    const lists = [list("a", 0), list("b", 1)];

    expect(reorderLists(lists, 1, -1).ordered.map((l) => l.id)).toEqual(["b", "a"]);
    expect(reorderLists(lists, 0, 7).ordered.map((l) => l.id)).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const lists = [list("a", 0), list("b", 1)];

    reorderLists(lists, 0, 1);

    expect(lists.map((l) => [l.id, l.sortOrder])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
