# Todo — Simple Todo code app

Definition of done for every task: lint 0 warnings, `npm run typecheck` clean, tests green, `npm run build` passes, spec updated if scope moved, **`README.md` updated** if the task changed the status table, layout, commands, stack or feature list, **notes added to `docs/how-to-build-a-power-apps-code-app.md`** if the task produced anything a reader would need (a non-obvious step, a failure and its fix, a decision worth explaining), commit on a feature branch. See `CLAUDE.md`.

Keep article notes brief and factual while building; Task 17 turns them into finished prose.

---

## Task 0: Import the `CodeApp101` Dataverse solution and assign the role

**Description:** Christopher imports `solution/CodeApp101_1_0_0_0.zip` into the environment via make.powerapps.com, or follows the manual fallback if the import is rejected, then assigns the `Todo User` security role to himself. Confirms code apps are enabled and the account holds Power Apps Premium.

**Acceptance criteria:**
- [x] Tables `cb_todolist`, `cb_todotask`, `cb_todosubtask` exist with the columns in SPEC §2
- [x] Relationships `cb_todolist_cb_todotask_list`, `cb_todotask_cb_todosubtask_task`, `cb_todotask_cb_todotask_recurrenceparent` exist
- [x] Security role `Todo User` exists and is assigned; code apps enabled on the environment

**Verification:**
- [x] Manual: Solutions → CodeApp101 → Tables shows three tables (2026-09-16)
- [x] Recorded in `docs/dataverse-setup.md`: Path A import succeeded on attempt 3

**Status: DONE 2026-09-16.**

**Dependencies:** None
**Files:** `solution/*`, `docs/dataverse-setup.md`
**Scope:** S (no code)

---

## Task 1: Scaffold project and tooling

**Description:** Bootstrap from `github:microsoft/PowerAppsCodeApps/templates/vite` into the repo root, then add Prettier, Vitest + RTL + user-event + jsdom, Playwright, `@/` path alias, npm scripts from SPEC §3, `.gitignore` additions, and the CI workflow (lint, typecheck, test, build).

**Acceptance criteria:**
- [x] `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass on a clean checkout
- [x] A trivial component test and a trivial Playwright smoke test run green locally
- [x] `.github/workflows/ci.yml` runs the same four commands on pull requests

**Verification:**
- [x] `npm run lint && npm run typecheck && npm test && npm run build`
- [x] `npx playwright test e2e/smoke.spec.ts`

**Status: DONE 2026-09-17.**

**Dependencies:** None
**Files:** `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`, `.prettierrc`, `.github/workflows/ci.yml`, `src/test/setup.ts`, `e2e/smoke.spec.ts`
**Scope:** M

---

## Task 2: Hallmark design foundation and app shell

**Description:** Run the Hallmark design flow (page scope, modern-minimal genre, catalog theme) to produce the token block, base reset, font loading and the two-pane shell (list sidebar that collapses to a bottom sheet under 768 px, main outlet). Record the theme choice and four-width screenshots in `docs/design/`. No feature UI yet.

**Acceptance criteria:**
- [x] `src/styles/tokens.css` defines all colour, type, space, radius and motion tokens; no other file contains a hex/OKLCH value or raw `font-family`
- [x] Shell renders with no horizontal scroll at 320/375/414/768/1024/1440; `html, body { overflow-x: clip }`
- [x] Hallmark pre-emit critique stamp present, every axis ≥ 3; headings roman; focus-visible rings on every control

**Verification:**
- [x] `npm run dev` → resize to each width (Chrome DevTools) → screenshots saved to `docs/design/`
- [x] Component tests for `AppShell` (sidebar toggles on mobile)

**Status: DONE 2026-09-17.** Theme: Coral. Fonts self-hosted via Fontsource (SPEC §2 amended).

**Dependencies:** T1
**Files:** `src/styles/tokens.css`, `src/styles/base.css`, `src/styles/fonts.css`, `src/App.tsx`, `src/components/AppShell/*`, `docs/design/theme.md`
**Scope:** M

---

## Task 3: Domain types, repo contracts, mock repo, query hooks

**Description:** Define `List`, `Task`, `Subtask`, `Recurrence` types and the `ListRepo`/`TaskRepo`/`SubtaskRepo` interfaces. Implement an in-memory mock repo seeded with sample data (deterministic for tests, optional latency for dev). Add react-query hooks (`useLists`, `useTasks(listId)`, `useTodayTasks`, `useCreateTask`, `useToggleTask`, `useUpdateTask`, `useDeleteTask`, list equivalents) with optimistic updates and rollback. Wire `QueryClientProvider` and a `RepoProvider` selecting mock vs Dataverse by `VITE_USE_MOCKS`.

**Acceptance criteria:**
- [x] Nothing outside `src/data` imports `src/generated`
- [x] Mock repo passes a shared contract test suite (`repoContract.test.ts`) that the Dataverse repo will reuse in T4
- [x] `useToggleTask` shows the optimistic state immediately and rolls back when the repo rejects

**Verification:**
- [x] `npm test -- src/data`
- [x] Coverage for `src/data` ≥ 90 %

**Status: DONE 2026-09-17.** `src/data` line coverage 100 %.

**Dependencies:** T1
**Files:** `src/data/repo.ts`, `src/data/mock/*.ts`, `src/data/queries.ts`, `src/data/keys.ts`, `src/data/RepoProvider.tsx`, `src/data/repoContract.test.ts`
**Scope:** M

---

## Task 4: Initialise the code app and wire Dataverse

**Description:** Christopher runs `pa auth login` once. Then `pa app init --display-name "Simple Todo" --environment-id Default-dc087386-56cb-4425-82f3-4b2dd04d62d8` and `pa app add data-source --connector dataverse --table …` for the three tables. Implement `src/data/dataverse/*` over the generated services, with `mappers.ts` handling column names, ISO dates, choice ints and `@odata.bind` lookups. Always pass `select`; updates send only changed columns.

**Acceptance criteria:**
- [x] `power.config.json` committed with three data sources; `src/generated/` present and untouched
- [x] Dataverse repo passes the shared contract test suite with generated services mocked via `vi.mock`
- [x] In `pa app run` Local Play: create a list, create a task in it (lookup bound), toggle it, delete it — all visible in the maker portal

**Verification:**
- [x] `npm test -- src/data/dataverse`
- [x] Manual Local Play check recorded in `docs/smoke.md`

**Status: DONE 2026-09-17.** Environment ID is `Default-dc087386-…` (the bare GUID is the tenant ID). Local Play check via `npm run dev:smoke`, recorded in `docs/smoke.md`.

**Dependencies:** T0, T3
**Files:** `power.config.json`, `src/generated/**` (generated), `src/data/dataverse/listRepo.ts`, `src/data/dataverse/taskRepo.ts`, `src/data/dataverse/subtaskRepo.ts`, `src/data/dataverse/mappers.ts`, `src/data/dataverse/*.test.ts`
**Scope:** M

---

## Checkpoint A (after T1–T4)
- [ ] All four commands green; CI green on the PR
- [ ] Shell renders with mock lists in `npm run dev` and with real lists in Local Play
- [x] Human review of the Hallmark theme and shell before feature work (approved 2026-09-17)

---

## Task 5: Lists

**Description:** Sidebar list navigation with open-task counts, create/rename inline, archive, reorder (drag on desktop, up/down buttons on mobile), and delete with the "move tasks to Inbox or delete" choice. Inbox is created on first run if the user has none and cannot be deleted. Routes `/list/:id`.

**Acceptance criteria:**
- [x] First load with zero lists creates "Inbox" exactly once (idempotent under React StrictMode double effects)
- [x] Deleting a non-empty list prompts; "Move to Inbox" reparents tasks before deleting the list
- [x] Keys `1`–`9` switch lists; `ListNav` ships all 8 interactive states

**Verification:**
- [x] `npm test -- ListNav`
- [x] Manual at 375 px: sidebar becomes a bottom sheet, reorder works with buttons

**Status: DONE 2026-09-17.** React Router 7 with `<HashRouter>` (SPEC §2 amended). Manual check in `npm run dev`: bottom sheet and up/down reorder at 375 px, delete with "Move to Inbox" on desktop. Drag reorder covered by component test only; scripted browser drags do not fire native drag events.

**Dependencies:** T3, T2
**Files:** `src/components/ListNav/*`, `src/routes/ListRoute.tsx`, `src/features/lists/ensureInbox.ts`, `src/data/queries.ts`
**Scope:** M

---

## Task 6: Task list and the Checkmark

**Description:** `TaskRow` list for the current list, ordered by `sortOrder` with overdue first; `Checkmark` component with 200 ms completion animation and a 3 s Undo toast; completed tasks collapse into a "Completed (n)" section; `/completed` route shows all completed tasks.

**Acceptance criteria:**
- [x] Toggle is optimistic; failure shows a toast with Retry and restores the row
- [x] Undo within 3 s reverts without a second network round-trip visible to the user
- [x] `Checkmark` and `TaskRow` ship all 8 states; touch target ≥ 44 px

**Verification:**
- [x] `npm test -- TaskRow Checkmark Toast`
- [x] Manual: animation and undo at 320 px and 1440 px

**Status: DONE 2026-09-17.** Toggle writes are serialised with a TanStack mutation scope and task caches refetch only when no task write is pending, so Undo never flickers. Also added `TaskList`, `useTaskToggle` and a Completed link in the sidebar. Manual check in `npm run dev` at 1440 px and 320 px: 44 px target, no horizontal scroll, no console errors.

**Dependencies:** T5
**Files:** `src/components/TaskRow/*`, `src/components/Checkmark/*`, `src/components/Toast/*`, `src/routes/CompletedRoute.tsx`
**Scope:** M

---

## Task 7: QuickAdd with natural-language dates

**Description:** Global `n` shortcut and "+" button focus a single-line QuickAdd. `parseQuickAdd(text, now)` uses chrono-node to extract a date/time and a recurrence phrase, returns `{ title, dueDate, hasTime, recurrence }`, and the UI shows a dismissible preview chip. Enter saves into the current list (Inbox from Today); Esc cancels; input stays focused after save for rapid entry.

**Acceptance criteria:**
- [ ] Table-driven test of ≥ 30 phrases passes, including negatives ("Email May about Q3" keeps "May"; "Buy 2 milks" has no date)
- [ ] "Buy milk on Friday" → title "Buy milk", dueDate next Friday, hasTime false; "Call Sam tomorrow 3pm" → hasTime true; "every Monday" → weekly with next Monday
- [ ] Optimistic insert; new row visible < 100 ms after Enter in mock mode

**Verification:**
- [ ] `npm test -- parseQuickAdd QuickAdd`
- [ ] Playwright: type phrase → chip shows date → Enter → row with due chip

**Dependencies:** T6
**Files:** `src/features/quickadd/parseQuickAdd.ts`, `src/features/quickadd/parseQuickAdd.test.ts`, `src/components/QuickAdd/*`, `src/hooks/useKeyboardShortcuts.ts`
**Scope:** M

---

## Task 8: Task detail

**Description:** Clicking a row expands an inline detail panel (no route change) with editable title, notes, due date picker, optional time, reminder offset select (none / at time / 10 min / 1 h / 1 day before), recurrence select, and Delete with undo. Overdue tasks are styled distinctly.

**Acceptance criteria:**
- [ ] Edits save on blur/Enter with only changed fields sent to the repo
- [ ] Clearing the time sets `hasTime=false` and keeps the date; reminder offset computes `reminderAt` from due date/time
- [ ] `e` opens detail for the selected row; Esc closes; all controls keyboard-operable

**Verification:**
- [ ] `npm test -- TaskDetail`
- [ ] Manual at 375 px: panel is a full-width sheet, date picker usable

**Dependencies:** T6
**Files:** `src/components/TaskDetail/*`, `src/components/DateField/*`, `src/features/reminders/computeReminderAt.ts`
**Scope:** M

---

## Task 9: Keyboard navigation

**Description:** `useKeyboardShortcuts` implements j/k selection, x toggle, e edit, Backspace delete (with undo), 1–9 lists, t Today, n QuickAdd, and ignores keys while typing in inputs. Selection ring uses tokens and is visible at all widths.

**Acceptance criteria:**
- [ ] Shortcuts inert when focus is in an input/textarea/contenteditable
- [ ] Selection persists across optimistic re-renders
- [ ] A "?" overlay lists shortcuts

**Verification:**
- [ ] `npm test -- useKeyboardShortcuts`

**Dependencies:** T7, T8
**Files:** `src/hooks/useKeyboardShortcuts.ts`, `src/hooks/useKeyboardShortcuts.test.ts`, `src/components/ShortcutHelp/*`
**Scope:** S

---

## Checkpoint B (after T5–T9)
- [ ] Playwright flow on Chromium desktop and iPhone 13 WebKit: create list → quick-add "Buy milk on Friday" → chip → Enter → complete → undo → delete
- [ ] Human review of the UI at four widths

---

## Task 10: Today view

**Description:** `/today` route (default landing) shows overdue and due-today tasks across all lists, grouped Overdue → Today, then by list. Last view is remembered in `localStorage`. Empty state: "Nothing due today." with a QuickAdd prompt.

**Acceptance criteria:**
- [ ] `selectToday(tasks, now)` unit-tested across midnight and DST boundaries
- [ ] QuickAdd from Today lands tasks in Inbox
- [ ] `t` navigates to Today

**Verification:**
- [ ] `npm test -- selectToday TodayRoute`

**Dependencies:** T9
**Files:** `src/features/today/selectToday.ts`, `src/features/today/selectToday.test.ts`, `src/routes/TodayRoute.tsx`
**Scope:** S

---

## Task 11: Subtasks

**Description:** Inside TaskDetail, a checklist of up to 50 subtasks with add/edit/toggle/reorder/delete. TaskRow shows `done/total` progress when subtasks exist. Completing all subtasks does not complete the parent.

**Acceptance criteria:**
- [ ] Subtask CRUD goes through `SubtaskRepo` with optimistic updates
- [ ] 51st subtask is refused with an inline message
- [ ] Progress text updates immediately on toggle

**Verification:**
- [ ] `npm test -- SubtaskList TaskRow`

**Dependencies:** T8
**Files:** `src/components/SubtaskList/*`, `src/components/TaskRow/TaskRow.tsx`, `src/data/queries.ts`
**Scope:** M

---

## Task 12: Recurring tasks

**Description:** `nextOccurrence(dueDate, recurrence)` computes daily/weekly/monthly (clamped to month end). Completing a task with recurrence ≠ none marks it complete and creates the next instance in the same list with the next due date, copied notes, reset subtasks and `recurrenceParent` set. "Stop repeating" sets recurrence to none on the current instance only.

**Acceptance criteria:**
- [ ] Unit tests: Jan 31 monthly → Feb 28/29 → Mar 31; weekly keeps weekday; DST-safe
- [ ] Undo of a recurring completion also removes the generated instance
- [ ] Uncompleting a recurring task does not create duplicates

**Verification:**
- [ ] `npm test -- nextOccurrence recurrence`
- [ ] Playwright: complete a weekly task → next instance appears dated +7 days

**Dependencies:** T11
**Files:** `src/features/recurrence/nextOccurrence.ts`, `src/features/recurrence/nextOccurrence.test.ts`, `src/features/recurrence/completeRecurring.ts`, `src/data/queries.ts`
**Scope:** M

---

## Task 13: Reminders in the open tab

**Description:** `useNotifications` requests permission on first reminder set (not on load), and a 30 s scheduler checks cached reminders and fires `new Notification(title, { body })` once per reminder, persisting fired IDs in `sessionStorage`. Settings row shows permission state.

**Acceptance criteria:**
- [ ] Scheduler unit-tested with fake timers: fires once, not before time, not twice
- [ ] Graceful when `Notification` is unavailable or denied (inline note, no errors)
- [ ] Clicking the notification focuses the tab and opens the task

**Verification:**
- [ ] `npm test -- scheduler useNotifications`
- [ ] Manual: set reminder 1 min ahead, notification appears

**Dependencies:** T8
**Files:** `src/features/reminders/scheduler.ts`, `src/features/reminders/scheduler.test.ts`, `src/hooks/useNotifications.ts`, `src/components/ReminderStatus/*`
**Scope:** S

---

## Task 14: Sync and resilience

**Description:** Configure react-query for refetch on window focus, visibility change, and 60 s interval while visible; global error toast with Retry; loading skeletons; empty states for lists and Today; `retry` policy for transient Dataverse errors.

**Acceptance criteria:**
- [ ] Change made in one tab appears in another within 60 s and immediately on focus (mock repo shared via BroadcastChannel in dev to simulate)
- [ ] Failed create/update/delete shows toast with Retry and rolls back
- [ ] No spinner longer than 300 ms without a skeleton

**Verification:**
- [ ] `npm test -- queries Toast`
- [ ] Manual two-tab check

**Dependencies:** T9
**Files:** `src/data/queryClient.ts`, `src/components/Toast/*`, `src/components/EmptyState/*`, `src/components/Skeleton/*`
**Scope:** S

---

## Checkpoint C (after T10–T14)
- [ ] Every S1–S8 acceptance criterion in SPEC §1 demonstrable in mock mode
- [ ] Coverage gates met (features/data ≥ 90 %, overall ≥ 70 %)

---

## Task 15: E2E suite, audits, documentation

**Description:** Complete Playwright specs (desktop Chromium + iPhone 13 WebKit) covering the flows in Checkpoints B and C; Lighthouse on the built app; `hallmark audit` on the final UI; README with clone-to-Local-Play in 15 minutes; `docs/smoke.md` checklist; ADRs 0001–0004.

**Acceptance criteria:**
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95
- [ ] Hallmark audit: zero gate failures
- [ ] README verified by following it on a clean clone

**Verification:**
- [ ] `npm run e2e`
- [ ] Lighthouse report saved to `docs/design/lighthouse.html`

**Dependencies:** T14
**Files:** `e2e/*.spec.ts`, `README.md`, `docs/smoke.md`, `docs/adr/000*.md`, `docs/design/*`
**Scope:** M

---

## Task 16: Publish and smoke test

**Description:** `npm run build`, `pa app push --solution-id <CodeApp101 id>`, `pa app share` with a second test user, then run `docs/smoke.md` on a phone browser and a desktop browser against real Dataverse.

**Acceptance criteria:**
- [ ] App opens from make.powerapps.com for a user holding only `Todo User`
- [ ] Task completed on the phone shows on desktop within 60 s
- [ ] SPEC §8 criteria 1–10 all pass; results recorded in `docs/smoke.md`

**Verification:**
- [ ] Manual smoke checklist with dates and outcomes

**Dependencies:** T0, T4, T15
**Files:** `docs/smoke.md`, `power.config.json`
**Scope:** S

---

## Task 17: Finish the how-to article

**Description:** Turn the running notes in `docs/how-to-build-a-power-apps-code-app.md` into finished Parts 2 to 4, matching the voice and structure of Part 1. Capture the screenshots listed as placeholders. Verify every command in the article actually runs as written.

**Acceptance criteria:**
- [ ] Parts 2, 3 and 4 complete, each following Overview → Prerequisites → Procedure → Verify → Troubleshooting → Related information
- [ ] Every placeholder in `docs/images/` replaced with a real screenshot, or the placeholder removed
- [ ] Every command block copy-pasted and run once on a clean checkout to confirm it works
- [ ] Troubleshooting entries carry the real error text encountered, not a paraphrase

**Verification:**
- [ ] A reader who has never used Power Platform can follow it start to finish
- [ ] No unresolved placeholder text remains

**Dependencies:** T16
**Files:** `docs/how-to-build-a-power-apps-code-app.md`, `docs/images/*`
**Scope:** M

---

## Checkpoint D — Done
- [ ] All tasks checked, SPEC §8 met, spec and ADRs current
- [ ] How-to article complete and publishable
