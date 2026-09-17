# CLAUDE.md

Guidance for Claude Code working in this repository. Keep it short; it loads every session.

## What this is

"Simple Todo", a Power Apps code app: React 19 + TypeScript + Vite, hosted in a Power Platform environment, data in Dataverse. See [README.md](README.md) for the overview and [SPEC.md](SPEC.md) for the specification.

Work proceeds one task at a time from [tasks/todo.md](tasks/todo.md), in dependency order. Do not start a task whose dependencies are unchecked.

## Definition of done for every task

1. Failing test first, then the implementation.
2. `npm run lint` (0 warnings), `npm run typecheck`, `npm test`, `npm run build` all pass.
3. **Update [README.md](README.md)** if the task changed anything a reader sees there: the status table, the repository layout, the getting-started commands, the stack, or the feature list. A task that adds a user-visible feature or a new command almost always touches the README.
4. **Append notes to [docs/how-to-build-a-power-apps-code-app.md](docs/how-to-build-a-power-apps-code-app.md)** if the task produced anything a reader repeating this build would need: a non-obvious step, a failure and its fix, a decision worth explaining. Brief and factual while building; task 17 turns the notes into finished prose.
5. **Update [SPEC.md](SPEC.md)** in the same commit if scope or schema changed.
6. Tick the task in [tasks/todo.md](tasks/todo.md) and commit. One commit per task, staging only that task's files.

Points 3 and 4 are easy to skip and are the reason documentation rots. Treat them as part of the task, not as follow-up work.

## Architecture rules

- **Nothing outside `src/data/` imports from `src/generated/`.** Components use the `ListRepo` / `TaskRepo` / `SubtaskRepo` interfaces in `src/data/repo.ts`.
- **`src/generated/` is written by the `pa` CLI. Never hand-edit it.** Regenerate with `pa app refresh data-source --name <data source>`, using the names in `power.config.json` (`todolists`, `todotasks`, `todosubtasks`).
- **Domain types are app-shaped**, not Dataverse-shaped. `Task.dueDate` is `Date | null`, not a `cb_duedate` ISO string. Mapping lives only in `src/data/dataverse/mappers.ts`.
- **Colours and fonts come from tokens only.** No hex, OKLCH or raw `font-family` outside `src/styles/tokens.css`. The UI follows the Hallmark skill; every interactive component ships all eight states.
- **Dataverse schema changes go through [solution/generate.py](solution/generate.py)**, never the portal alone. Regenerate, re-import, and commit the result.

## Commands

```bash
npm run dev        # Vite against the in-memory data layer, no tenant needed
npm run dev:dataverse  # Vite on :3000 against real Dataverse; open the printed "Local Play" URL
npm run dev:smoke  # as above, with the Dataverse smoke-test panel in the main pane
npm test           # vitest run
npm run build      # tsc -b && vite build
```

The CLI is `pa` (npm, `@microsoft/power-apps-cli`), not `pac`. It runs on macOS. `pac code` commands no longer exist.

Environment ID: `Default-dc087386-56cb-4425-82f3-4b2dd04d62d8` (the tenant's default environment; the bare GUID is the tenant ID and the CLI cannot resolve it). Dataverse org: `https://org6e4abf07.crm.dynamics.com/`. Solution: `CodeApp101`, publisher prefix `cb`.

## Ask before

Changing the Dataverse schema or security role, adding a runtime dependency, running `pa app push`, or changing CI. See the boundaries section of [SPEC.md](SPEC.md).
