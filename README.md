# Simple Todo — a Power Apps code app

A personal task app built as a **Power Apps code app**: an ordinary React single-page application that runs inside a Microsoft Power Platform environment, stores its data in Dataverse, and inherits Entra authentication and tenant governance without building any of it.

> **Status: feature build under way.** The specification, plan and Dataverse schema are done and the schema is deployed. The foundation is in place and the first feature, lists, works in mock mode. See [Current status](#current-status).

## What it does

A distraction-free todo list, designed so capturing a task takes under five seconds.

- **Fast capture** — press `n`, type, press Enter. Typing `Buy milk on Friday` creates a task called "Buy milk" due next Friday, with the date parsed in the browser.
- **Multiple lists** — Work, Personal, Groceries, and an Inbox that is created automatically. Press `1` to `9` to switch lists; drag to reorder on desktop, or use the up and down buttons in edit mode.
- **Due dates and reminders** — deadlines, optional times, and browser notifications while the app is open.
- **Completing tasks** — a ticked task animates, stays in place for a moment, then moves to a collapsed Completed section. Undo is offered for three seconds; `/completed` shows everything you have finished.
- **Today view** — overdue and due-today tasks across every list, and the default landing view.
- **Recurring tasks** — daily, weekly or monthly, with the next instance created on completion.
- **Subtasks** — checklist steps inside a task, with progress shown on the row.
- **Works everywhere** — one responsive web app on phone, tablet and desktop, with Dataverse as the single source of truth.

Deliberately out of scope for version one: sharing, assignment, attachments, tags, offline mode, and the Power Apps mobile player, which does not support code apps.

## How it is built

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Vite, from the official code apps template |
| Routing | React Router 7 with hash URLs, which survive reloads inside the Power Apps player |
| Design | Hand-built CSS on a token system, no component library; Hallmark Coral theme, Geist self-hosted |
| Server state | TanStack Query, with optimistic updates and refetch on focus |
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
src/routes/              one component per route: /list/:id and /completed so far
src/hooks/               React hooks shared across components, such as toggling a task with Undo
src/features/            domain logic with no React, such as Inbox creation and list reordering
src/data/                domain types, repository interfaces, in-memory and Dataverse repos, TanStack Query hooks
src/generated/           written by the pa CLI from the Dataverse tables; never edited by hand
.power/                  table schemas the generated services import; also CLI-owned
power.config.json        code app configuration: environment and data sources
docs/design/             theme choice and shell screenshots at six widths
e2e/                     Playwright specs
.github/workflows/ci.yml lint, typecheck, test and build on every pull request
```

## Getting started

```bash
npm install
npm run dev
```

That starts Vite in `mock` mode, which loads `.env.mock` and runs against in-memory sample data, so it needs no tenant access.

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
``` To run against the real environment instead, sign in once, then start Vite without mocks:

```bash
npx pa auth login
npm run dev:dataverse
```

Open the URL labelled **Local Play** in the same browser profile you use for the tenant. `npm run dev:smoke` does the same, with a panel that creates, completes and deletes a test list and task; see [`docs/smoke.md`](docs/smoke.md).

Prerequisites, permissions and the governance controls that apply in a corporate tenant are covered in the [how-to article](docs/how-to-build-a-power-apps-code-app.md).

## Current status

| | |
|---|---|
| Specification | Complete — [`SPEC.md`](SPEC.md) |
| Plan | Complete — [`tasks/plan.md`](tasks/plan.md) |
| Dataverse schema | Deployed to the environment, 16 September 2026 |
| Application code | Scaffold, test tooling and CI (task 1); design tokens and responsive app shell (task 2); domain types, repositories and query hooks (task 3); Dataverse repositories, smoke-tested against the environment (task 4); lists in the sidebar with counts, create, rename, reorder, archive, delete and number-key switching (task 5); task rows with the checkmark, Undo and Retry toasts, and the Completed view (task 6). Next up is task 7, quick add |
| Documentation | Parts 1 and 2 of 4 written: planning, schema, project foundation, Dataverse wiring. Part 3 build notes started |

Work proceeds one task at a time from [`tasks/todo.md`](tasks/todo.md). Each task writes a failing test first, leaves the app working, and lands as its own commit.

## Documentation

- **[How to build a Power Apps code app](docs/how-to-build-a-power-apps-code-app.md)** — the full build log written as a knowledge-base article, including every failure and its fix. Written for someone repeating this from scratch.
- **[Dataverse setup](docs/dataverse-setup.md)** — the operational runbook for the schema, with a click-by-click manual fallback.
- **[SPEC.md](SPEC.md)** — what is being built and why, with acceptance criteria.

## Phase two

Not in the current plan, to be specified separately: reminder emails through a scheduled Power Automate flow to Outlook, and automated deployment from GitHub Actions using a service principal.
