export type SortOrderChange = { id: string; sortOrder: number };

/**
 * Moves one item, such as a list or a subtask, to a new position and numbers the result 0, 1, 2,
 * ... Returns the reordered items and only the changes a repository needs to persist.
 */
export function reorderLists<T extends SortOrderChange>(
  lists: readonly T[],
  fromIndex: number,
  toIndex: number,
): { ordered: T[]; changes: SortOrderChange[] } {
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
