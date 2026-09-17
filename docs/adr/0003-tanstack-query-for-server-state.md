# ADR 0003 · TanStack Query owns server state; there is no client store

**Status:** Accepted, 17 September 2026 · **Context:** tasks 3, 6 and 14

## Context

The app's state is almost entirely server state: lists, tasks and subtasks in Dataverse. It needs
optimistic updates (ticking a box must feel instant), rollback when a write fails, and refresh when
the user comes back to the tab. Dataverse offers no push channel, so "sync" means polling and
refetching. A general state library such as Redux or Zustand would hold a second copy of the data
and leave caching, retries and invalidation to be hand-written.

## Decision

Use **TanStack Query v5** as the only store for server data, with one client configured in
`src/data/queryClient.ts`:

- reads refetch on window focus, on the tab becoming visible, and every 60 s while visible;
- reads retry twice for transient failures (408, 429, 5xx, network), never for 4xx;
- writes never retry automatically, because a repeated create makes a duplicate; failures roll the
  cache back and offer Retry in a toast;
- writes are awaited through `mutateAsync`, so a failure is reported even after the component that
  started it has gone.

React state holds only UI concerns: which panel is open, which row is selected, sheet open or shut.

## Consequences

- No bespoke cache, no store boilerplate, and optimistic updates are a documented pattern rather
  than an invention.
- Two rules had to be learned: a mutation's per-call callbacks are unreliable (see task 14), and
  concurrent writes to one record need a shared `scope` so they reach the server in order.
- Polling costs one request per query per minute while the tab is visible, including one subtask
  query per visible row. Acceptable for a personal list; revisit if the smoke test shows throttling.
- Tests configure their own client with retries off, so a failing repository fails fast.
