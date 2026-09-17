# ADR 0002 · Put a repository interface between the app and Dataverse

**Status:** Accepted, 17 September 2026 · **Context:** tasks 3 and 4

## Context

`pa app add data-source` generates typed services under `src/generated/`. They speak Dataverse:
logical names such as `cb_duedate`, ISO date strings, choice integers, `@odata.bind` lookups, and an
`IOperationResult` wrapper. Calling them from components would spread those details through the UI,
tie every test to a generated client, and block all UI work until the tables existed.

## Decision

Define `ListRepo`, `TaskRepo` and `SubtaskRepo` in `src/data/repo.ts` in the app's own vocabulary
(`Task.dueDate` is a `Date | null`), and provide two implementations:

- `src/data/mock/` — in memory, seeded, used by `npm run dev`, every unit and component test, and
  all Playwright runs.
- `src/data/dataverse/` — wraps the generated services; all column mapping lives in `mappers.ts`.

Both implementations must pass the same contract test suite (`src/data/repoContract.ts`).
**Nothing outside `src/data/` may import `src/generated/`**, and a test enforces that.

## Consequences

- Tasks 5 to 14 were built and tested with no tenant access, and the same code ran against Dataverse
  unchanged.
- Tests are fast and deterministic: no network, no service principal, no fixtures of OData payloads.
- The contract suite is the safety net. A Dataverse-only bug is only caught if the contract covers
  the behaviour, so the contract grows whenever a repository gains a rule.
- Cost: one mapping layer to maintain, and two implementations to keep honest.
