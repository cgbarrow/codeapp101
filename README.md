# Simple Todo — a Power Apps code app

A personal task app built as a **Power Apps code app**: an ordinary React single-page application that runs inside a Microsoft Power Platform environment, stores its data in Dataverse, and inherits Entra authentication and tenant governance without building any of it.

> **Status: planning complete, build not started.** The specification, implementation plan and Dataverse schema are done, and the schema is deployed. No application code exists yet. See [Current status](#current-status).

## What it does

A distraction-free todo list, designed so capturing a task takes under five seconds.

- **Fast capture** — press `n`, type, press Enter. Typing `Buy milk on Friday` creates a task called "Buy milk" due next Friday, with the date parsed in the browser.
- **Multiple lists** — Work, Personal, Groceries, and an Inbox that is created automatically.
- **Due dates and reminders** — deadlines, optional times, and browser notifications while the app is open.
- **Today view** — overdue and due-today tasks across every list, and the default landing view.
- **Recurring tasks** — daily, weekly or monthly, with the next instance created on completion.
- **Subtasks** — checklist steps inside a task, with progress shown on the row.
- **Works everywhere** — one responsive web app on phone, tablet and desktop, with Dataverse as the single source of truth.

Deliberately out of scope for version one: sharing, assignment, attachments, tags, offline mode, and the Power Apps mobile player, which does not support code apps.

## How it is built

| Layer | Choice |
|---|---|
| UI | React 19, TypeScript, Vite, from the official code apps template |
| Design | Hand-built CSS on a token system, no component library |
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
src/                     application code (not yet created)
e2e/                     Playwright specs (not yet created)
```

## Getting started

Nothing to run yet. Once the scaffold lands in task 1:

```bash
npm install
npm run dev
```

That starts Vite against the in-memory data layer, which needs no tenant access. To run against the real environment instead:

```bash
pa auth login
pa app run
```

Then open the URL labelled **Local Play**, in the same browser profile you use for the tenant.

Prerequisites, permissions and the governance controls that apply in a corporate tenant are covered in the [how-to article](docs/how-to-build-a-power-apps-code-app.md).

## Current status

| | |
|---|---|
| Specification | Complete — [`SPEC.md`](SPEC.md) |
| Plan | Complete — [`tasks/plan.md`](tasks/plan.md) |
| Dataverse schema | Deployed to the environment, 16 September 2026 |
| Application code | Not started, next up is task 1 |
| Documentation | Part 1 of 4 published |

Work proceeds one task at a time from [`tasks/todo.md`](tasks/todo.md). Each task writes a failing test first, leaves the app working, and lands as its own commit.

## Documentation

- **[How to build a Power Apps code app](docs/how-to-build-a-power-apps-code-app.md)** — the full build log written as a knowledge-base article, including every failure and its fix. Written for someone repeating this from scratch.
- **[Dataverse setup](docs/dataverse-setup.md)** — the operational runbook for the schema, with a click-by-click manual fallback.
- **[SPEC.md](SPEC.md)** — what is being built and why, with acceptance criteria.

## Phase two

Not in the current plan, to be specified separately: reminder emails through a scheduled Power Automate flow to Outlook, and automated deployment from GitHub Actions using a service principal.
