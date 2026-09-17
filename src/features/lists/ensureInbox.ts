import type { List, ListRepo } from "@/data/repo";

export const INBOX_NAME = "Inbox";

const inFlight = new WeakMap<ListRepo, Promise<List>>();

/**
 * Returns the user's Inbox, creating it first if they have none. Concurrent calls against the same
 * repository share one attempt, so React StrictMode's doubled effects cannot create two Inboxes.
 */
export function ensureInbox(repo: ListRepo): Promise<List> {
  const pending = inFlight.get(repo);
  if (pending) return pending;

  const attempt = findOrCreateInbox(repo).finally(() => inFlight.delete(repo));
  inFlight.set(repo, attempt);
  return attempt;
}

async function findOrCreateInbox(repo: ListRepo): Promise<List> {
  const lists = await repo.getAll();
  const existing = lists.find((list) => list.isInbox);
  if (existing) return existing;

  const firstSortOrder = Math.min(0, ...lists.map((list) => list.sortOrder));
  return repo.create({
    name: INBOX_NAME,
    isInbox: true,
    sortOrder: lists.length === 0 ? 0 : firstSortOrder - 1,
  });
}
