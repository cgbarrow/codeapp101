import type { Repos } from "@/data/repo";

export type DeleteListOptions = {
  /** Where to move the list's tasks first, or `null` to delete them with the list. */
  moveTasksTo: string | null;
};

/**
 * Deletes a list. Tasks are moved one at a time and the list is deleted only after every move has
 * succeeded, so a failure never loses a task.
 */
export async function deleteList(repos: Repos, listId: string, { moveTasksTo }: DeleteListOptions) {
  const lists = await repos.lists.getAll();
  if (lists.find((list) => list.id === listId)?.isInbox) {
    throw new Error("The Inbox cannot be deleted");
  }
  if (moveTasksTo === listId) {
    throw new Error("Tasks cannot be moved into the list being deleted");
  }

  if (moveTasksTo !== null) {
    const [moving, staying] = await Promise.all([
      repos.tasks.getByList(listId),
      repos.tasks.getByList(moveTasksTo),
    ]);
    let sortOrder = Math.max(-1, ...staying.map((task) => task.sortOrder)) + 1;
    for (const task of moving) {
      await repos.tasks.update(task.id, { listId: moveTasksTo, sortOrder: sortOrder++ });
    }
  }

  await repos.lists.delete(listId);
}
