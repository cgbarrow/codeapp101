# CLAUDE.md

Guidance for Claude Code working in this repository. Keep it short; it loads every session.

## What this is

"Simple Todo", a Power Apps code app: React 19 + TypeScript + Vite, hosted in a Power Platform environment, data in Dataverse. See [README.md](README.md) for the overview and [SPEC.md](SPEC.md) for the specification.

Work proceeds one task at a time from [tasks/todo.md](tasks/todo.md), in dependency order. Do not start a task whose dependencies are unchecked.

## Definition of done for every task

1. Failing test first, then the implementation.
2. `npm run lint` (0 warnings), `npm run typecheck`, `npm test`, `npm run build` all pass.
3. **Update [README.md](README.md)** if the task changed anything a reader sees there: the status table, the repository layout, the getting-started commands, the stack, or the feature list. A task that adds a user-visible feature or a new command almost always touches the README.
4. **Update [docs/how-to-build-a-power-apps-code-app.md](docs/how-to-build-a-power-apps-code-app.md)** if the task changed anything a reader following it would meet: a command, a step, a file it names, or a new failure and its fix. It is a step-by-step guide, not a build log, so edit the relevant step, Verify or Troubleshooting entry concisely rather than appending notes.
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

The CLI is `pa` (npm, `@microsoft/power-apps-cli`), not `pac`. It runs on macOS. `pac code` commands no longer exist. It is a devDependency, not a global install, so run it as `npx pa`. Its sign-in is cached per machine: a new machine needs `npx pa auth login` once, and `npx pa auth status` shows the active account (the account this build used is in `CLAUDE.local.md`).

Tenant specifics (environment ID, Dataverse org URL, solution ID, app ID, sign-in account) are not in the repository, which is public. They live in `CLAUDE.local.md` (gitignored; Claude Code loads it automatically). The environment ID and app ID are also in `power.config.json`, which `pa` writes and the repo commits. Solution: `CodeApp101`, publisher prefix `cb`; `npx pa solution list | grep -i CodeApp101` prints its ID. The bare tenant GUID is not an environment ID and the CLI cannot resolve it.

## Current state — 28 September 2026

All coding tasks, 0–17, are done. What remains needs the tenant, a second test user or a human, so it belongs to Christopher. Do not tick any of it from a coding session:

- Task 16's smoke test: checklist in [docs/smoke.md](docs/smoke.md).
- Task 13's manual reminder check and Checkpoint B's human UI review.
- Task 17's leftovers. One screenshot placeholder remains in [the article](docs/how-to-build-a-power-apps-code-app.md), `local-play-smoke.png`; capturing it or deleting the placeholder both satisfy the criterion. The command check also needs a tenant run of `pa app init`, `add data-source` and `push`.
- Checkpoint D, which closes once all of the above are done.

On 28 September 2026 the article was rewritten from a build log into a step-by-step guide: five parts, Steps 1 to 22, clone to sample data to Local Play to published app, then Part 5 (added 7 October 2026), which forks the repository, changes the Today empty-state text test-first and publishes again, with a Verify section after each part. Christopher edits his own copy outside the repository (Word or Google Docs) and sends it as a PDF. The `.md` in the repo is kept in line with that copy, so treat his latest revision as the source of truth. Its screenshots in `docs/images/` and its OPS links (AccelerateON, OnRequest, WIA) came from his document. It is written for OPS developers: keep it concise, say where every command runs, and point governance questions at AccelerateON. The repository is public; the article tells readers to fork it, and Part 5 pushes their branch to the fork, never to the original. The example change is not merged into `main`. A coding session can edit the article for accuracy, but has no remaining task to work on.

Nothing else about this repository is machine-specific. A fresh clone needs `npm install`, `npx playwright install chromium webkit` for the e2e suite, and `npx pa auth login` only for tenant work; the README's Getting started covers it. Node was 24.14.1 and npm 11.11.0 here; the repo pins no version.

## Ask before

Changing the Dataverse schema or security role, adding a runtime dependency, running `pa app push`, or changing CI. See the boundaries section of [SPEC.md](SPEC.md).
