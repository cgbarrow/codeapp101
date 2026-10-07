# Simple Todo — a Power Apps code app

A personal task app built as a **Power Apps code app**: an ordinary React single-page application that runs inside a Microsoft Power Platform environment, stores its data in Dataverse, and inherits Entra authentication and tenant governance without building any of it.

> **Status: published, smoke test outstanding.** Every feature is built, tested and audited, the app is published to the environment, and the how-to article is written end to end. What remains needs the tenant: the manual smoke test against real Dataverse on a phone and a desktop, and one screenshot the article still marks as a placeholder. See [Current status](#current-status).

## What it does

A distraction-free todo list, designed so capturing a task takes under five seconds.

- **Fast capture** — press `n`, type, press Enter. Typing `Buy milk on Friday` creates a task called "Buy milk" due next Friday, with the date parsed in the browser. A chip previews the date before you save; click it to keep the words in the title instead. `every Monday`, `every day` and `every month` set a repeat.
- **Multiple lists** — Work, Personal, Groceries, and an Inbox that is created automatically. Press `1` to `9` to switch lists; drag to reorder on desktop, or use the up and down buttons in edit mode.
- **Due dates and reminders** — click a task, or select it and press `e`, to edit its title, notes, due date, time, reminder and repeat in place; on a phone the editor is a bottom sheet. Deleting offers Undo. While the app is open, a reminder shows a browser notification within 30 seconds of its time; clicking it opens the task. Permission is asked for the first time you set a reminder, and the sidebar shows whether reminders are on, off, blocked or unsupported.
- **Completing tasks** — a ticked task animates, stays in place for a moment, then moves to a collapsed Completed section. Undo is offered for three seconds; `/completed` shows everything you have finished.
- **Today view** — overdue and due-today tasks across every list, and the default landing view.
- **Recurring tasks** — daily, weekly (same weekday) or monthly (same day, clamped to the month end, so the 31st lands on 28 February and back on 31 March). Completing one creates the next instance in the same list, with notes copied, the reminder moved along and subtasks unticked. Undo removes it again, and "Stop repeating" ends the chain on that task only.
- **Subtasks** — up to 50 checklist steps inside a task's editor: add, rename, tick, reorder with up and down buttons, and delete. The row shows progress such as `1/3`. Ticking every step leaves the task itself open, and Undo after deleting a task brings its subtasks back.
- **Keyboard first** — `j`/`k` to move, `x` to complete, `e` to edit, Backspace to delete, `n` for a new task, `1`–`9` for lists, `?` for the full list.
- **Works everywhere** — one responsive web app on phone, tablet and desktop, with Dataverse as the single source of truth. A change made on one device shows on another within a minute, and at once when you switch back to the app. A failed save puts the screen back as it was and offers Retry; brief network and server errors are retried automatically.

Deliberately out of scope for version one: sharing, assignment, attachments, tags, offline mode, and the Power Apps mobile player, which does not support code apps.

## How it is built

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Vite, from the official code apps template |
| Routing | React Router 7 with hash URLs, which survive reloads inside the Power Apps player |
| Design | Hand-built CSS on a token system, no component library; Hallmark Coral theme, Geist self-hosted |
| Server state | TanStack Query, with optimistic updates, refetch on focus and every 60 seconds, and retries for transient errors |
| Date parsing | `chrono-node`, in the browser, behind one `parseQuickAdd` function |
| Platform | `@microsoft/power-apps` client library and the `pa` CLI |
| Data | Three custom Dataverse tables in the `CodeApp101` solution |
| Tests | Vitest and Testing Library for units and components, Playwright for end to end |

Two decisions shape the codebase.

**A repository interface sits between the app and Dataverse.** Components talk to `ListRepo`, `TaskRepo` and `SubtaskRepo`, never to generated Dataverse services. An in-memory implementation backs local development and every test, so fifteen of the seventeen tasks build without a tenant connection, and Dataverse column names stay out of the UI.

**The Dataverse schema is code.** [`solution/generate.py`](solution/generate.py) emits an importable solution package, so the schema is diffable, reviewable and reproducible in a second environment rather than living only in the tenant.

## Repository layout

```
SPEC.md                  the specification: objective, stack, structure, boundaries
tasks/plan.md            implementation plan, dependency graph, risks
tasks/todo.md            17 tasks with acceptance criteria and verification steps
solution/generate.py     Dataverse schema of record; emits the solution package
solution/src/            generated solution XML
docs/                    how-to article, setup runbook, design notes, ADRs
src/                     application code; src/test/ holds the Vitest setup
src/styles/              design tokens (the only place colours and fonts are defined), reset, fonts
src/components/          one folder per component, with its CSS module and test
src/routes/              one component per route: /today, /list/:id and /completed
src/hooks/               React hooks shared across components: keyboard shortcuts, toggling and deleting a task with Undo, saving with Retry, notifications
src/features/            domain logic with no React, such as Inbox creation, reordering, quick-add parsing, the Today selection, recurrence and the reminder scheduler
src/data/                domain types, repository interfaces, in-memory and Dataverse repos, the query client and TanStack Query hooks
src/generated/           written by the pa CLI from the Dataverse tables; never edited by hand
.power/                  table schemas the generated services import; also CLI-owned
power.config.json        code app configuration: environment and data sources
docs/adr/                architecture decision records (0001-0004)
docs/design/             theme choice, shell screenshots at six widths, Lighthouse report
e2e/                     Playwright specs
.github/workflows/ci.yml lint, typecheck, test and build on every pull request
```

## Getting started

```bash
npm install
npm run dev
```

That starts Vite in `mock` mode, which loads `.env.mock` and runs against in-memory sample data, so it needs no tenant access. Tabs in the same browser share that data, so you can try sync: change something in one tab, then switch to another.

Checks, all of which must pass before a commit:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Coverage, with the SPEC gates of 90 % of lines in `src/data` and `src/features` and 70 % overall:

```bash
npm run test:coverage
```

End-to-end tests need the Playwright browsers once:

```bash
npx playwright install chromium webkit
npm run e2e
```

To refresh the shell screenshots in `docs/design/`:

```bash
SHELL_SCREENSHOTS=1 npx playwright test e2e/shell.spec.ts --project desktop-chromium
```

## From clone to Local Play in 15 minutes

Local Play runs the app on your machine against the **real** Dataverse tables, with the Power Apps
host supplying the connection. Steps 1 and 2 need nothing but Node; steps 3 to 6 need a Power
Platform environment with code apps switched on and a Power Apps Premium licence.

| | Step | Command | Time |
|---|---|---|---|
| 1 | Clone and install | `git clone <this repo> && cd codeapp101 && npm install` | ~2 min |
| 2 | Check it works with no tenant at all | `npm run dev` then open the printed URL | ~1 min |
| 3 | Import the schema | In [make.powerapps.com](https://make.powerapps.com) → Solutions → Import, choose `solution/CodeApp101_1_0_0_0.zip`, then assign yourself the `Todo User` role. Full steps and the manual fallback: [`docs/dataverse-setup.md`](docs/dataverse-setup.md) | ~5 min |
| 4 | Sign in to the CLI | `npx pa auth login` (opens a browser) | ~1 min |
| 5 | Point the app at your environment | The committed `power.config.json` names the author's environment and published app, so replace it: delete it, run `npx pa app init --display-name "Simple Todo" --environment-id <id>`, then `npx pa app add data-source --connector dataverse --table <table> --org-url <instance-url>` for `cb_todolist`, `cb_todotask` and `cb_todosubtask`. Both values are in make.powerapps.com → Settings → Session details. Step 9 of the [how-to article](docs/how-to-build-a-power-apps-code-app.md) explains each command | ~3 min |
| 6 | Run against Dataverse | `npm run dev:dataverse`, then open the URL labelled **Local Play** in the browser profile signed in to the tenant | ~1 min |

`npm run dev:smoke` does the same as step 6 with a panel that creates, completes and deletes a test
list and task, which is the quickest way to prove the connection; see [`docs/smoke.md`](docs/smoke.md).

If the app opens but the lists never load, you are almost certainly signed in to a different profile
than the one that opened Local Play. The [how-to article](docs/how-to-build-a-power-apps-code-app.md)
covers prerequisites, licensing and the governance controls that apply in a corporate tenant, and
its troubleshooting section carries the real error text for every failure hit during this build.

## Current status

| | |
|---|---|
| Specification | Complete — [`SPEC.md`](SPEC.md) |
| Plan | Complete — [`tasks/plan.md`](tasks/plan.md) |
| Dataverse schema | Deployed to the environment, 16 September 2026 |
| Published app | Pushed to the `CodeApp101` solution, 17 September 2026 — app ID in `power.config.json`. Sharing and the [smoke checklist](docs/smoke.md) outstanding |
| Application code | Scaffold, test tooling and CI (task 1); design tokens and responsive app shell (task 2); domain types, repositories and query hooks (task 3); Dataverse repositories, smoke-tested against the environment (task 4); lists in the sidebar with counts, create, rename, reorder, archive, delete and number-key switching (task 5); task rows with the checkmark, Undo and Retry toasts, and the Completed view (task 6); quick add with natural-language dates and the `n` shortcut (task 7); the task detail editor with reminders and delete with Undo (task 8); keyboard navigation and a shortcut list (task 9); the Today view as the default landing, with `t` and the last view remembered (task 10); subtasks with row progress (task 11); recurring tasks (task 12); reminder notifications in the open tab (task 13); refetching, retries, reliable failure toasts and loading placeholders (task 14); end-to-end flows, Lighthouse and Hallmark audits, ADRs (task 15); published to the environment (task 16). Still to do: Checkpoint B, and the manual smoke test of the published app |
| Documentation | [How-to article](docs/how-to-build-a-power-apps-code-app.md) complete: a step-by-step guide in four parts and 14 steps, from clone to Local Play to a published app, with a Verify section after each part (task 17, revised 28 September 2026). Outstanding: the Local Play smoke-panel screenshot, and the `pa` command blocks that cannot be re-run without changing the environment. ADRs 0001–0004 written; audits recorded in [`docs/design/audit-2026-09-17.md`](docs/design/audit-2026-09-17.md) |

Work proceeds one task at a time from [`tasks/todo.md`](tasks/todo.md). Each task writes a failing test first, leaves the app working, and lands as its own commit.

## Documentation

- **[How to build a Power Apps code app](docs/how-to-build-a-power-apps-code-app.md)** — a step-by-step guide from a clone of this repository to the app running locally against Dataverse and published to an environment, with the real error text for each failure hit along the way.
- **[Dataverse setup](docs/dataverse-setup.md)** — the operational runbook for the schema, with a click-by-click manual fallback.
- **[SPEC.md](SPEC.md)** — what is being built and why, with acceptance criteria.
- **[Architecture decisions](docs/adr/)** — why the `pa` CLI, the repository pattern, TanStack Query and a generated solution package.
- **[Audit results](docs/design/audit-2026-09-17.md)** — Lighthouse scores and the Hallmark audit of the finished UI.
- **[Smoke checks](docs/smoke.md)** — where each acceptance criterion is proved, and the manual checklist for the published app.

## Phase two

Not in the current plan, to be specified separately: reminder emails through a scheduled Power Automate flow to Outlook, and automated deployment from GitHub Actions using a service principal.
