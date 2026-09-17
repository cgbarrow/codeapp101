import type { List } from "@/data/repo";

const STORAGE_KEY = "simple-todo:last-view";
const TODAY = "/today";
const VIEW = /^\/(today|completed|list\/[^/]+)$/;

/** Remembers the view at `path` for the next visit. Paths that are not views are ignored. */
export function saveLastView(path: string) {
  if (!VIEW.test(path)) return;
  try {
    localStorage.setItem(STORAGE_KEY, path);
  } catch {
    // Storage can be blocked, for example in a private window; the app then lands on Today.
  }
}

export function readLastView(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Where the app opens: the remembered view if it still exists, otherwise Today. */
export function landingPath(stored: string | null, lists: readonly List[]) {
  if (!stored || !VIEW.test(stored)) return TODAY;
  const listId = stored.match(/^\/list\/(.+)$/)?.[1];
  if (listId && !lists.some((list) => list.id === listId)) return TODAY;
  return stored;
}
