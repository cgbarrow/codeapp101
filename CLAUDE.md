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

The CLI is `pa` (npm, `@microsoft/power-apps-cli`), not `pac`. It runs on macOS. `pac code` commands no longer exist. It is a devDependency, not a global install, so run it as `npx pa`. Its sign-in is cached per machine: a new machine needs `npx pa auth login` once, and `npx pa auth status` shows the active account (this build used `Mackensen5659@vy7kt.onmicrosoft.com`).

Environment ID: `Default-dc087386-56cb-4425-82f3-4b2dd04d62d8` (the tenant's default environment; the bare GUID is the tenant ID and the CLI cannot resolve it). Dataverse org: `https://org6e4abf07.crm.dynamics.com/`. Solution: `CodeApp101`, publisher prefix `cb`, solution ID `cb31311c-e547-4888-b237-04b0ad14fd06` — the ID is not derivable from the repository, `npx pa solution list | grep -i CodeApp101` prints it. Published app ID `5e72594e-4a1c-4c2c-9b6b-7eae8479a302`, also in `power.config.json`.

## Current state — 17 September 2026

Tasks 0–15 are done. Task 16 published the app; **its smoke test is outstanding** and needs the tenant, a second test user and two devices, so it belongs to Christopher — checklist in [docs/smoke.md](docs/smoke.md). Task 13's manual reminder check and Checkpoint B's human UI review are outstanding for the same reason. Do not tick any of them from a coding session.

**Next task: 17, finishing the how-to article.** Parts 1 and 2 of [the article](docs/how-to-build-a-power-apps-code-app.md) are finished prose and set the voice and the `#### Step n:` structure; Parts 3 and 4 are still raw per-task build notes, each marked with a "Build notes" blockquote. `docs/images/` is empty and three screenshot placeholders remain (import solution, Local Play smoke panel, publisher list) — all three need the tenant, so they are Christopher's to capture or to delete.

Nothing else about this repository is machine-specific. A fresh clone needs `npm install`, `npx playwright install chromium webkit` for the e2e suite, and `npx pa auth login` only for tenant work; the README's Getting started covers it. Node was 24.14.1 and npm 11.11.0 here; the repo pins no version.

## Ask before

Changing the Dataverse schema or security role, adding a runtime dependency, running `pa app push`, or changing CI. See the boundaries section of [SPEC.md](SPEC.md).
