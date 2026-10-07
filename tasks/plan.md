# Implementation Plan: Simple Todo — Power Apps Code App

Spec: [`SPEC.md`](../SPEC.md). Task checklist: [`todo.md`](todo.md).

## Overview

Build a personal todo app as a Power Apps code app (React 19 + TypeScript + Vite) backed by three custom Dataverse tables in the `CodeApp101` solution, styled by Hallmark, and published to the developer environment with the npm `pa` CLI. Work is sliced vertically: each task after the foundation delivers one user-visible capability end to end (domain logic → data layer → UI → tests).

## Architecture decisions

- **`pa` CLI, run from this Mac.** `@microsoft/power-apps-cli` is npm-based and works in any terminal (verified 1.0.2). `pa auth login` opens a browser, so the sign-in step is done by Christopher once; everything else is scriptable. ADR 0001.
- **Repository pattern over generated services.** `src/data/repo.ts` defines `ListRepo`/`TaskRepo`/`SubtaskRepo`. Two implementations: `mock/` (in-memory, used by `npm run dev` with `VITE_USE_MOCKS=true`, all unit/component tests and Playwright) and `dataverse/` (wraps `src/generated/services`). This lets every UI task be built and tested before Dataverse is wired, and keeps `cb_*` column names out of components. ADR 0002.
- **TanStack Query for all server state** with optimistic mutations and rollback, refetch on focus/visibility, 60 s polling. This is the whole "sync" story. ADR 0003.
- **Domain types are app-shaped** (`Task.dueDate: Date | null`, `Recurrence: "none" | "daily" | "weekly" | "monthly"`). Mapping to Dataverse (`cb_duedate` ISO strings, choice ints 100000000–100000003, `cb_List@odata.bind`) lives only in `src/data/dataverse/mappers.ts`.
- **Schema as a generated solution package.** `solution/generate.py` writes `customizations.xml`/`solution.xml` and zips them. Import via the maker portal. If Dataverse rejects the hand-authored package, `docs/dataverse-setup.md` has the manual path and we re-export the resulting solution into `solution/`. ADR 0004.
- **Hallmark, page-scope, catalog theme.** Hallmark's design flow runs once in Task 2 to produce `tokens.css`, the shell and the theme record; every later component consumes those tokens and ships the 8 states.
- **Recurrence is materialised on completion**, not computed on read: completing a recurring task creates the next instance (linked by `cb_recurrenceparent`). Simple queries, honest history.

## Dependency graph

```
T0 Dataverse solution imported ─────────────────┐
                                                 │
T1 Scaffold + tooling + CI                       │
   └─ T2 Hallmark tokens + app shell             │
   └─ T3 Domain types + repo contracts + mock ───┼─ T4 pa init + data sources + Dataverse repo
          │                                      │
          ├─ T5 Lists (nav, CRUD, Inbox)         │
          │    └─ T6 Task list + Checkmark       │
          │         ├─ T7 QuickAdd + NLP dates   │
          │         ├─ T8 Task detail            │
          │         └─ T9 Keyboard shortcuts     │
          │              ├─ T10 Today view       │
          │              ├─ T11 Subtasks         │
          │              ├─ T12 Recurrence       │
          │              ├─ T13 Reminders        │
          │              └─ T14 Sync + errors    │
          │                    └─ T15 E2E, audits, README
          │                         └─ T16 Publish + smoke (needs T0, T4)
```

T0 runs in parallel with T1–T3 (it is Christopher-side in the maker portal). T4 needs T0 and T3. Everything from T5 on runs against the mock repo, so it does not block on Dataverse; T16 is the first task that needs the real environment end to end.

## Task list

### Phase 0 · Environment (Christopher, parallel with Phase 1)
- [x] T0 Import `CodeApp101` solution and assign the `Todo User` role (done 2026-09-16; user is also System Administrator on the environment)

### Phase 1 · Foundation
- [ ] T1 Scaffold from the official Vite template; add Prettier, Vitest, RTL, Playwright, path alias, CI workflow
- [ ] T2 Hallmark design foundation: tokens, base CSS, fonts, app shell responsive at 320/375/414/768
- [ ] T3 Domain types, repo interfaces, mock repo, react-query hooks
- [ ] T4 `pa app init`, add three Dataverse data sources, Dataverse repo + mappers

**Checkpoint A** — lint/typecheck/test/build green; `npm run dev` shows the shell with mock lists; `pa app run` Local Play loads the shell against the tenant; human review.

### Phase 2 · Core slices
- [ ] T5 Lists: sidebar nav, create/rename/archive/reorder, Inbox auto-created on first run
- [ ] T6 Task list + Checkmark: view tasks in a list, optimistic complete/uncomplete with undo, Completed section
- [ ] T7 QuickAdd: `n` shortcut, `parseQuickAdd` with chrono-node, date preview chip, Enter/Esc
- [ ] T8 Task detail: inline expand with title, notes, due date/time, reminder offset, delete with undo, overdue styling
- [ ] T9 Keyboard navigation: j/k/x/e/⌫/1–9/t

**Checkpoint B** — Playwright: create list → quick-add "Buy milk on Friday" → see chip → complete → undo, on desktop Chromium and iPhone WebKit; human review of the UI at four widths.

### Phase 3 · Extras
- [ ] T10 Today view: `selectToday`, Overdue → Today grouping, default landing, remembered view
- [ ] T11 Subtasks: list inside detail, progress `2/5` on the row, reorder, no auto-complete of parent
- [ ] T12 Recurrence: `nextOccurrence`, completion creates next instance with reset subtasks, "Stop repeating"
- [ ] T13 Reminders: permission prompt, 30 s scheduler, browser Notification while tab open
- [ ] T14 Sync + resilience: focus/visibility/60 s refetch, error toasts with Retry, empty states

**Checkpoint C** — all spec acceptance criteria for S1–S8 demonstrable against the mock repo; coverage gates met.

### Phase 4 · Ship
- [ ] T15 Full Playwright suite, Lighthouse ≥ 90/95, Hallmark audit clean, README + smoke checklist
- [ ] T16 `npm run build` → `pa app push --solution-id …` → `pa app share` → smoke on phone and desktop against real Dataverse
- [ ] T17 Finish the how-to article: Parts 2 to 4, screenshots, command verification

**Checkpoint D (Done)** — SPEC §8 success criteria 1–10 all true; how-to article complete.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Hand-authored solution zip rejected on import | Med | Manual fallback steps in `docs/dataverse-setup.md`; T0 verification says which path was used; after a manual build, export and commit the real zip |
| `pa app add data-source` generates service shapes that differ from the docs (lookup binding, choice formatting) | Med | T4 writes mapper tests against the actual generated types; repo interface isolates the rest of the app |
| Lookup writes require `@odata.bind` and the SDK has no dedicated helper yet | Med | Mapper encapsulates it; T4 acceptance includes creating a task with a list lookup in Local Play |
| Local Play needs the tenant browser profile and local-network permission | Low | Documented in README; Playwright never uses Local Play |
| chrono-node parses too eagerly ("Call May" → May) | Med | Table-driven tests with negative cases; parse only trailing/leading date phrases; chip is dismissible |
| Browser notifications denied or tab closed | Known | In-scope limitation; Phase 2 Outlook flow |
| Hallmark theme rotation picks something unsuitable for a utility app | Low | Constrain to modern-minimal genre; record and review at Checkpoint A |
| Power Apps Premium licence missing for test users | Med | Confirm in T0 |

## Parallelization

- Safe in parallel: T0 with T1–T3; T7/T8/T9 after T6; T10–T14 after T9 (they touch different feature folders).
- Sequential: T1 → T2 → T3 (shared foundations); T4 after T3 and T0; T16 last.
- Contract-first: `src/data/repo.ts` (T3) is the contract that lets UI tasks and the Dataverse implementation proceed independently.

## Documentation as we go

`docs/how-to-build-a-power-apps-code-app.md` is a knowledge-base article written alongside the build, not after it. Part 1 (planning, schema, environment) is finished. Each task appends brief notes: any non-obvious step, any failure and what fixed it, any decision a reader would ask about. Task 17 turns those notes into finished prose. Writing it during the build is the point, because the failures are what make it useful and they are forgotten within a day.

## Out of this plan

- GitHub Actions deploy with a service principal (`pa app push --non-interactive`).
- Teams or mobile push, a per-user email opt-out, and a service-account flow for all users.

The Power Automate reminder flow and the change-and-redeploy guide are Phase 2 and are planned below.

---

# Phase 2: change-and-redeploy guide, and email reminders

Spec: [`SPEC.md` §10](../SPEC.md#10-phase-2-change-and-redeploy-guide-and-email-reminders-via-power-automate), approved 2026-10-05 with all defaults. Tasks 18–23 in [`todo.md`](todo.md).

## Overview

Two deliverables, each code or schema change plus article steps. **A** is a new Part 5 teaching the inner loop (branch, test-first edit, Local Play, gates, commit, build, push) with the Today empty-state wording as the change. **B** is a new Part 6: a `cb_reminderemailsentat` column, app logic that re-arms it, a read-only "Email sent" line, and a scheduled Power Automate flow built in the maker portal that emails the owner through Outlook.

## Architecture decisions

- **Polling flow, not a row trigger.** A 5-minute scheduled flow with a Dataverse filter, then an `cb_reminderemailsentat` stamp to prevent repeats. Simpler to explain and to debug than long-running waits. Concurrency set to 1 so overlapping runs cannot double-send. ADR 0005.
- **The app owns re-arming.** Any update that changes `reminderAt` sends `cb_reminderemailsentat: null` in the same PATCH, inside the repo layer, so every caller gets it. Contract-tested against mock and Dataverse fake.
- **Flow is not in Git.** Built by hand in the portal and added to `CodeApp101`; the article lists each expression verbatim and is its source of record. Runs under the reader's connection, so it sees only their tasks (SPEC P5).
- **Solution version 1.1.0.0.** The schema change ships as a renamed zip so the upgrade import is unambiguous (O2).
- **Feature A's example change is not merged.** The shipped wording stays; the article's change is demonstrated on a branch in a fork. The repository is public, so readers fork it and push to their own fork; nobody but the owner pushes to the original.

## Dependency graph

```
T18 Feature A: Part 5 article ─────────────────────────────┐ (independent; reused by T22)
T19 Schema: cb_reminderemailsentat, v1.1.0.0 zip
   └─ [Christopher: re-import, npx pa app refresh data-source --name todotasks]
        └─ T20 Data layer: field, mappers, re-arm rule, contract tests
             └─ T21 UI: "Email sent" line
                  └─ T22 Feature B: Part 6 article, README, SPEC updates, ADR 0005
                       └─ T23 Checkpoint E: tenant run (Christopher)
```

T18 and T19 can run in parallel. T20 cannot start until the column exists in `src/generated/`, which needs Christopher's re-import and refresh (a tenant action).

## Phases and checkpoints

1. **Slice 1 (T18):** Feature A complete as prose, every local command run on a clean clone.
2. **Slice 2 (T19–T21):** the column, data rules and UI, shippable on their own with mock data, no flow needed.
3. **Slice 3 (T22–T23):** the flow article and the tenant verification.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Upgrade import of an unmanaged solution fails or duplicates | Med | Bump to 1.1.0.0; test import on Christopher's tenant before T20; fall back to adding the column by hand in the portal and re-exporting, as in `docs/dataverse-setup.md` |
| `pa app refresh data-source` generates a differently-shaped column type (DateTime as string) | Low | Mapper test written against the real generated type; repo interface isolates the rest |
| Flow double-sends or sends a flood after downtime | Med | `cb_reminderemailsentat eq null` filter, 24 h floor, concurrency 1 |
| Reader lacks Power Automate Premium | Med | Prerequisite box; Feature A and the app half of B stand alone |
| Flow sees only the owner's tasks (User-level role) | Known | Stated in the article; service-account path named but out of scope |
| Portal steps I cannot run go stale or are wrong | Med | Mark each unrun step as unverified, as in task 17; Christopher runs them at Checkpoint E |
| Time zone off in the email | Low | `convertTimeZone` to Eastern, covered in Troubleshooting |
| App link format for code apps unverified (O4) | Low | Marked unverified until clicked from a real email |
