import type { List } from "@/data/repo";

export type SortOrderChange = { id: string; sortOrder: number };

/**
 * Moves one list to a new position and numbers the result 0, 1, 2, ... Returns the reordered
 * lists and only the changes a repository needs to persist.
 */
export function reorderLists(
  lists: readonly List[],
  fromIndex: number,
  toIndex: number,
): { ordered: List[]; changes: SortOrderChange[] } {
  const moved = [...lists];
  const target = Math.min(Math.max(toIndex, 0), moved.length - 1);
  const [item] = moved.splice(fromIndex, 1);
  moved.splice(target, 0, item);

  const changes: SortOrderChange[] = [];
  const ordered = moved.map((list, sortOrder) => {
    if (list.sortOrder === sortOrder) return list;
    changes.push({ id: list.id, sortOrder });
    return { ...list, sortOrder };
  });
  return { ordered, changes };
}
