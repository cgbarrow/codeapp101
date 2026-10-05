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
- [x] Table-driven test of ≥ 30 phrases passes, including negatives ("Email May about Q3" keeps "May"; "Buy 2 milks" has no date)
- [x] "Buy milk on Friday" → title "Buy milk", dueDate next Friday, hasTime false; "Call Sam tomorrow 3pm" → hasTime true; "every Monday" → weekly with next Monday
- [x] Optimistic insert; new row visible < 100 ms after Enter in mock mode

**Verification:**
- [x] `npm test -- parseQuickAdd QuickAdd`
- [x] Playwright: type phrase → chip shows date → Enter → row with due chip

**Status: DONE 2026-09-17.** 38-phrase table; parser adds guards for chrono false positives (`Now`, durations, bare months, `sat`/`sun`), reads bare hours 1–7 as pm, and parses `every …` itself. `e2e/quickadd.spec.ts` measures Enter-to-row inside the page and asserts < 100 ms in Chromium and WebKit. `useKeyboardShortcuts` created here and used by ListNav; task 9 extends it. `chrono-node` adds ~19 kB gzipped.

**Dependencies:** T6
**Files:** `src/features/quickadd/parseQuickAdd.ts`, `src/features/quickadd/parseQuickAdd.test.ts`, `src/components/QuickAdd/*`, `src/hooks/useKeyboardShortcuts.ts`
**Scope:** M

---

## Task 8: Task detail

**Description:** Clicking a row expands an inline detail panel (no route change) with editable title, notes, due date picker, optional time, reminder offset select (none / at time / 10 min / 1 h / 1 day before), recurrence select, and Delete with undo. Overdue tasks are styled distinctly.

**Acceptance criteria:**
- [x] Edits save on blur/Enter with only changed fields sent to the repo
- [x] Clearing the time sets `hasTime=false` and keeps the date; reminder offset computes `reminderAt` from due date/time
- [x] `e` opens detail for the selected row; Esc closes; all controls keyboard-operable

**Verification:**
- [x] `npm test -- TaskDetail`
- [x] Manual at 375 px: panel is a full-width sheet, date picker usable

**Status: DONE 2026-09-17.** Date-only reminders fire at 9:00. Delete sends at once and Undo recreates the task (new id); **T11 must add subtasks to the undo snapshot.** Clearing the due date also clears reminder and repeat. `e` opens the last focused or clicked row until T9 adds j/k. Unit tests pinned to America/Toronto for DST. The 375 px check was split: sheet layout checked in the in-app browser; date and time entry, 44 px input and full-width sheet covered by `e2e/taskdetail.spec.ts` on iPhone 13 WebKit, because scripted keys do not reach native date inputs in the in-app browser.

**Dependencies:** T6
**Files:** `src/components/TaskDetail/*`, `src/components/DateField/*`, `src/features/reminders/computeReminderAt.ts`
**Scope:** M

---

## Task 9: Keyboard navigation

**Description:** `useKeyboardShortcuts` implements j/k selection, x toggle, e edit, Backspace delete (with undo), 1–9 lists, t Today, n QuickAdd, and ignores keys while typing in inputs. Selection ring uses tokens and is visible at all widths.

**Acceptance criteria:**
- [x] Shortcuts inert when focus is in an input/textarea/contenteditable
- [x] Selection persists across optimistic re-renders
- [x] A "?" overlay lists shortcuts

**Verification:**
- [x] `npm test -- useKeyboardShortcuts`

**Status: DONE 2026-09-17.** j/k move focus as well as selection; Backspace and Delete select a neighbour after deleting. `?` opens a native `<dialog>` that returns focus to where it was. **`t` moved to T10**, which builds the Today route. `e2e/keyboard.spec.ts` covers the keys and the dialog in Chromium and WebKit.

**Dependencies:** T7, T8
**Files:** `src/hooks/useKeyboardShortcuts.ts`, `src/hooks/useKeyboardShortcuts.test.ts`, `src/components/ShortcutHelp/*`
**Scope:** S

---

## Checkpoint B (after T5–T9)
- [x] Playwright flow on Chromium desktop and iPhone 13 WebKit: create list → quick-add "Buy milk on Friday" → chip → Enter → complete → undo → delete (`e2e/flow.spec.ts`, task 15)
- [ ] Human review of the UI at four widths — **for Christopher.** Screenshots in `docs/design/`, or `npm run dev` and resize

---

## Task 10: Today view

**Description:** `/today` route (default landing) shows overdue and due-today tasks across all lists, grouped Overdue → Today, then by list. Last view is remembered in `localStorage`. Empty state: "Nothing due today." with a QuickAdd prompt.

**Acceptance criteria:**
- [x] `selectToday(tasks, now)` unit-tested across midnight and DST boundaries
- [x] QuickAdd from Today lands tasks in Inbox
- [x] `t` navigates to Today

**Verification:**
- [x] `npm test -- selectToday TodayRoute`

**Status: DONE 2026-09-17.** Today filters the per-list caches (`useTasksInLists`) instead of `useTodayTasks`, so optimistic changes show at once; archived lists are left out. Selection, shortcuts and the detail panel moved from `TaskList` into `useTaskRows`, shared by both views. Quick add from Today confirms "Added … to Inbox." `e2e/smoke.spec.ts` now expects Today as the landing view; `e2e/today.spec.ts` covers grouping, Inbox quick add, the remembered view and `t` in Chromium and WebKit. Manual check in the in-app browser at 1280 px and 375 px: no horizontal scroll, no console errors.

**Dependencies:** T9
**Files:** `src/features/today/selectToday.ts`, `src/features/today/selectToday.test.ts`, `src/routes/TodayRoute.tsx`
**Scope:** S

---

## Task 11: Subtasks

**Description:** Inside TaskDetail, a checklist of up to 50 subtasks with add/edit/toggle/reorder/delete. TaskRow shows `done/total` progress when subtasks exist. Completing all subtasks does not complete the parent.

**Acceptance criteria:**
- [x] Subtask CRUD goes through `SubtaskRepo` with optimistic updates
- [x] 51st subtask is refused with an inline message
- [x] Progress text updates immediately on toggle

**Verification:**
- [x] `npm test -- SubtaskList TaskRow`

**Status: DONE 2026-09-17.** Reorder uses up/down buttons, sharing a now-generic `reorderLists`. Row progress uses one subtask query per visible task (see the how-to notes for the cost). Delete Undo from T8 now restores subtasks; `useCreateTask` takes an optional `subtasks` array. Manual check in `npm run dev` at desktop width, 375 px and 320 px: ticking updates the row, no horizontal scroll, 44 px targets, no console errors.

**Dependencies:** T8
**Files:** `src/components/SubtaskList/*`, `src/components/TaskRow/TaskRow.tsx`, `src/data/queries.ts`
**Scope:** M

---

## Task 12: Recurring tasks

**Description:** `nextOccurrence(dueDate, recurrence)` computes daily/weekly/monthly (clamped to month end). Completing a task with recurrence ≠ none marks it complete and creates the next instance in the same list with the next due date, copied notes, reset subtasks and `recurrenceParent` set. "Stop repeating" sets recurrence to none on the current instance only.

**Acceptance criteria:**
- [x] Unit tests: Jan 31 monthly → Feb 28/29 → Mar 31; weekly keeps weekday; DST-safe
- [x] Undo of a recurring completion also removes the generated instance
- [x] Uncompleting a recurring task does not create duplicates

**Verification:**
- [x] `npm test -- nextOccurrence recurrence`
- [x] Playwright: complete a weekly task → next instance appears dated +7 days

**Status: DONE 2026-09-17.** No `date-fns`: plain local calendar arithmetic. `recurrenceParentId` links each instance to the previous one, and `anchorDayOf` follows that link to bring a clamped monthly date back to its original day. The next due date counts from the old due date, not from today, so a late completion can create an overdue instance. The "Stop repeating" button sits in the detail footer. `e2e/recurrence.spec.ts` covers completion and Undo in Chromium and WebKit. The Undo toast still reads "Completed …", without the next date.

**Dependencies:** T11
**Files:** `src/features/recurrence/nextOccurrence.ts`, `src/features/recurrence/nextOccurrence.test.ts`, `src/features/recurrence/completeRecurring.ts`, `src/data/queries.ts`
**Scope:** M

---

## Task 13: Reminders in the open tab

**Description:** `useNotifications` requests permission on first reminder set (not on load), and a 30 s scheduler checks cached reminders and fires `new Notification(title, { body })` once per reminder, persisting fired IDs in `sessionStorage`. Settings row shows permission state.

**Acceptance criteria:**
- [x] Scheduler unit-tested with fake timers: fires once, not before time, not twice
- [x] Graceful when `Notification` is unavailable or denied (inline note, no errors)
- [x] Clicking the notification focuses the tab and opens the task

**Verification:**
- [x] `npm test -- scheduler useNotifications`
- [ ] Manual: set reminder 1 min ahead, notification appears. **Open:** the in-app browser reports `denied`, so this needs Christopher in desktop Chrome with `npm run dev`. `e2e/reminders.spec.ts` covers the same flow in Chromium and WebKit with a recording `Notification` stand-in and Playwright's clock.

**Status: DONE 2026-09-17, except the manual check above.** Only reminders that come due after the app opened (less one 30 s interval) fire. The scheduler reads the task caches the sidebar counts already load. Permission is asked for when a reminder is chosen, and the status row sits in the sidebar. **Risk for T16:** a published app runs in a cross-origin iframe, where Chromium refuses notification permission; expect the "blocked" state there and record the result in `docs/smoke.md`.

**Dependencies:** T8
**Files:** `src/features/reminders/scheduler.ts`, `src/features/reminders/scheduler.test.ts`, `src/hooks/useNotifications.ts`, `src/components/ReminderStatus/*`
**Scope:** S

---

## Task 14: Sync and resilience

**Description:** Configure react-query for refetch on window focus, visibility change, and 60 s interval while visible; global error toast with Retry; loading skeletons; empty states for lists and Today; `retry` policy for transient Dataverse errors.

**Acceptance criteria:**
- [x] Change made in one tab appears in another within 60 s and immediately on focus (mock repo shared via BroadcastChannel in dev to simulate)
- [x] Failed create/update/delete shows toast with Retry and rolls back
- [x] No spinner longer than 300 ms without a skeleton

**Verification:**
- [x] `npm test -- queries Toast`
- [x] Manual two-tab check

**Status: DONE 2026-09-17.** `src/data/queryClient.ts` adds a window `focus` listener (TanStack v5 listens only for `visibilitychange`), the 60 s interval and a transient-only read retry; writes never auto-retry. Failure toasts were being lost: per-call `mutate` callbacks fire only for the latest call and not after unmount. Every write now uses `mutateAsync`, through `useSaveWithRetry` or the toggle and delete hooks, and ListNav's inline alert does the same. `SkeletonRows` replaces blanks in Completed and subtasks and the copies in TaskList and Today. No `EmptyState` component: the existing empty states (list, Today, Completed) already meet the criterion. Mock repos sync across tabs over `BroadcastChannel`; `e2e/sync.spec.ts` covers it in Chromium and WebKit. Manual two-tab check in the in-app browser: a completion in one tab showed in the other when it came to the front.

**Dependencies:** T9
**Files:** `src/data/queryClient.ts`, `src/components/Toast/*`, `src/components/EmptyState/*`, `src/components/Skeleton/*`
**Scope:** S

---

## Checkpoint C (after T10–T14)
- [x] Every S1–S8 acceptance criterion in SPEC §1 demonstrable in mock mode — the table in `docs/smoke.md` says where each one is proved
- [x] Coverage gates met (features/data ≥ 90 %, overall ≥ 70 %): 97 % of lines overall on 17 September 2026

---

## Task 15: E2E suite, audits, documentation

**Description:** Complete Playwright specs (desktop Chromium + iPhone 13 WebKit) covering the flows in Checkpoints B and C; Lighthouse on the built app; `hallmark audit` on the final UI; README with clone-to-Local-Play in 15 minutes; `docs/smoke.md` checklist; ADRs 0001–0004.

**Acceptance criteria:**
- [x] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95 — 98 and 100, see `docs/design/audit-2026-09-17.md`
- [x] Hallmark audit: zero gate failures — 0 critical, 0 major; two minor stamp gaps found and fixed
- [x] README verified by following it on a clean clone, as far as a machine can: `git clone`, `npm install`, then lint, typecheck, test and build all green. **Steps 3–6 (import the solution, `pa auth login`, Local Play) need the tenant and are for Christopher.**

**Verification:**
- [x] `npm run e2e`: 36 runs green — 18 tests on desktop Chromium and the same 18 on iPhone 13 WebKit
- [x] Lighthouse report saved to `docs/design/lighthouse.html`

**Status: DONE 2026-09-17, except the human review of the UI in Checkpoint B and the tenant half of the README walk-through.** `e2e/flow.spec.ts` covers the Checkpoint B flow and "Move to Inbox"; the Checkpoint C mapping lives in `docs/smoke.md`. Playwright caught a mobile bug: the list sheet stayed open over a newly created list, because it only closed on link clicks; the shell now closes it on any route change. Lighthouse found CLS 0.152 from the Today view's loading state, fixed to 0 (Performance 98, Accessibility 100). Hallmark audit: two missing stamps, fixed. ADRs 0001–0004 written. `npm run build:mock` and `npm run preview:mock` added, because the Dataverse build cannot run outside the Power Apps host.

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

**Status: PUBLISHED 2026-09-17; the smoke test is outstanding and is for Christopher.** `npm run build` then `pa app push --solution-id cb31311c-e547-4888-b237-04b0ad14fd06` succeeded; app ID `5e72594e-4a1c-4c2c-9b6b-7eae8479a302`, confirmed by `pa app list`, and `power.config.json` now carries it. The solution ID is not in the repository — `pa solution list | grep -i CodeApp101` prints it. `push` uploads `./dist` and does not build, so build immediately before pushing. Remaining, all needing the tenant and a second device: `pa app share` plus the `Todo User` role for the second test user (Christopher is doing this in the maker portal), then the ten checks in `docs/smoke.md`. Expect check 6 (reminders) to fail in the player's cross-origin iframe, as flagged in task 13.

**Dependencies:** T0, T4, T15
**Files:** `docs/smoke.md`, `power.config.json`
**Scope:** S

---

## Task 17: Finish the how-to article

**Description:** Turn the running notes in `docs/how-to-build-a-power-apps-code-app.md` into finished Parts 2 to 4, matching the voice and structure of Part 1. Capture the screenshots listed as placeholders. Verify every command in the article actually runs as written.

**Acceptance criteria:**
- [x] Parts 2, 3 and 4 complete, each following Overview → Prerequisites → Procedure → Verify → Troubleshooting → Related information
- [ ] Every placeholder in `docs/images/` replaced with a real screenshot, or the placeholder removed
- [ ] Every command block copy-pasted and run once on a clean checkout to confirm it works
- [x] Troubleshooting entries carry the real error text encountered, not a paraphrase

**Verification:**
- [ ] A reader who has never used Power Platform can follow it start to finish
- [ ] No unresolved placeholder text remains

**Status: DONE 2026-09-18, except the three screenshots and the tenant half of the command check — both for Christopher.**

Part 3 became Steps 12–22 and Part 4 Steps 23–25, continuing Part 2's numbering, so the article now runs Step 1 to Step 25 with no "Task n notes" headings left. The six-section shape is the article's, not each part's: Overview, Prerequisites, Procedure, Verify, Troubleshooting and Related information are top-level, the parts sit under Procedure, and Verify now has an "After Part 3" and an "After Part 4" to match Parts 1 and 2. Part 4 ends with a "What comes after" step covering the Power Automate phase, service-principal deployment and the subtask query cost.

**Revised 28 September 2026.** Christopher asked for a step-by-step guide rather than a build log and supplied a revised Word version. The article now runs Steps 1 to 14 in four parts: plan and set up Dataverse, run on your machine, what the app does (one feature table), and publish and share. Each part ends with its own Verify section. Every command says where it runs; `power.config.json`, `add data-source` and design tokens are explained; and the steps were cross-checked against a Microsoft code apps walkthrough video. Screenshots and OPS links came from the Word document.

Two troubleshooting entries were added from this machine, both with real error text: the Windows PowerShell execution policy that makes every `npx pa` block in the article fail with `npx.ps1 cannot be loaded`, and the three test-portability failures found when the suite first ran on Windows (path separators, the default locale, and timer granularity). Those fixes landed in commit `d9cea84`, before the article work.

**Outstanding, all needing the tenant:**

- One screenshot placeholder remains, `local-play-smoke.png`. Capture it or delete the placeholder; either satisfies the criterion. The other two were replaced on 28 September 2026 with Christopher's own screenshots.
- `pa auth login`, `pa auth status`, `pa app list` and `pa solution list` were all run on this machine on 18 September 2026 and work as written. `pa app init`, `pa app add data-source` and `pa app push` cannot be re-run without changing the environment — `init` and `add data-source` would rewrite `power.config.json` and `src/generated/`, and `push` republishes — so their blocks stand on the original build's record.
- Whether a newcomer can follow it start to finish is a human judgement and belongs with the Checkpoint B review.

**Dependencies:** T16
**Files:** `docs/how-to-build-a-power-apps-code-app.md`, `docs/images/*`
**Scope:** M

---

## Checkpoint D — Done
- [ ] All tasks checked, SPEC §8 met, spec and ADRs current
- [ ] How-to article complete and publishable

---

# Phase 2: change-and-redeploy guide, and email reminders

Spec: SPEC §10 (approved 2026-10-05, defaults accepted for O1–O5). Plan: `tasks/plan.md`, Phase 2. Same definition of done as above, including README and article updates. Tasks that need the tenant are marked **(Christopher)** and are not ticked from a coding session.

---

## Task 18: Feature A — Part 5, change the app and publish it again

**Description:** Add **Part 5 · Change the app and publish it again** to the article (Steps 15–22) and a **Verify Part 5** section, teaching branch → test-first edit → Local Play → gates → local commit → build → `pa app push` → verify, using the Today empty-state text as the change.

**Acceptance criteria:**
- [ ] Every use of `Nothing due today.` is found (`grep -rn` across `src` and `e2e`) and listed in the article, and the step ordering is: change tests, see them fail, change component, see them pass
- [ ] Steps say where each command runs and give PowerShell variants where a command differs; the push step reuses Step 11's solution ID
- [ ] Article explains why `push` updates the same app (`appId` in `power.config.json`) and what to do if the old text still shows
- [ ] Two Troubleshooting entries: old UI after a successful push, and a second app created by `push`
- [ ] README status table and layout/feature mentions updated if affected
- [ ] The example change is demonstrated on a throwaway branch and **not** merged; `main` keeps the original wording

**Verification:**
- [ ] Run steps 15–21 on a clean clone: `npm test` fails then passes, `npm run lint && npm run typecheck && npm test && npm run build` pass
- [ ] `npm run dev` shows the new text on an empty Today
- [ ] Step 22 (`push` and opening the app) marked as not run; for Christopher at Checkpoint E

**Dependencies:** None
**Files:** `docs/how-to-build-a-power-apps-code-app.md`, `README.md`
**Scope:** M

---

## Task 19: Schema — `cb_reminderemailsentat`, solution 1.1.0.0

**Description:** Add the nullable UTC DateTime column `cb_reminderemailsentat` ("Reminder email sent at") to `cb_todotask` in `solution/generate.py`; bump `VERSION` to 1.1.0.0; regenerate and commit `solution/CodeApp101_1_1_0_0.zip`; remove the 1.0.0.0 zip; update every reference to the zip name.

**Acceptance criteria:**
- [ ] `customizations.xml` contains the new column with the right type, behaviour and display name; no other schema change
- [ ] References to `CodeApp101_1_0_0_0.zip` and "version 1.0.0.0" updated in `README.md`, `docs/dataverse-setup.md`, the article (Steps 3–4) and `generate.py`
- [ ] `docs/dataverse-setup.md` gains a short "Upgrading an existing install" section and a manual fallback for adding just this column
- [ ] SPEC §2 task table lists the column; `CLAUDE.md` zip-name mentions, if any, updated
- [ ] Failing test first: a Python or node test that parses the generated XML and asserts the column and version (add under `solution/` or a vitest node test, whichever the repo already uses for generated artefacts)

**Verification:**
- [ ] `python3 solution/generate.py` is idempotent (second run produces no diff)
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] **(Christopher)** Import the new zip over the existing solution and confirm the column appears in Dataverse; then run `npx pa app refresh data-source --name todotasks` and commit the regenerated `src/generated/`

**Dependencies:** None
**Files:** `solution/generate.py`, `solution/*.zip`, `docs/dataverse-setup.md`, `SPEC.md`, `README.md`, article
**Scope:** M

---

## Task 20: Data layer — `reminderEmailSentAt` and the re-arm rule

**Description:** Add `Task.reminderEmailSentAt: Date | null` to `src/data/repo.ts`, its default in `defaults.ts`, mapping in `mappers.ts`, behaviour in the mock and Dataverse repos. An update that changes or clears `reminderAt` also nulls `reminderEmailSentAt` in the same PATCH; an update that does not touch `reminderAt` leaves it out. Completing a recurring task creates the next instance with `null`.

**Acceptance criteria:**
- [ ] Contract tests in `repoContract.ts` (written first, run against mock and the Dataverse fake) cover: round trip; re-arm on reminder change; re-arm on clear; untouched when other fields change; recurring next instance resets
- [ ] Mapper tests assert the exact outgoing PATCH shape and that unchanged-reminder updates omit the column
- [ ] Nothing outside `src/data/` imports `src/generated/`; `src/generated/` is not hand-edited
- [ ] Coverage gates (90 % on `src/data`) still met

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] `npm run dev:smoke` against Dataverse: set a reminder, set `cb_reminderemailsentat` by hand in the portal, change the reminder, confirm it clears **(Christopher)**

**Dependencies:** T19 and the tenant re-import plus `pa app refresh` by Christopher
**Files:** `src/data/repo.ts`, `src/data/defaults.ts`, `src/data/repoContract.ts`, `src/data/dataverse/mappers.ts` (+ tests), `src/data/dataverse/dataverseRepos.ts`, `src/data/dataverse/fakeDataverse.ts`, `src/data/mock/*`
**Scope:** M (touches more than five files, all in one folder; split into mock-first and Dataverse-second commits only if it grows)

---

## Task 21: UI — read-only "Email sent" line

**Description:** In `TaskDetail`, show "Email sent 9:00 am" when `reminderEmailSentAt` is set, formatted with the existing date helpers, tokens only. Non-interactive text, so the eight states do not apply.

**Acceptance criteria:**
- [ ] Component test first: line absent when `null`, present with formatted time when set, hidden when the reminder is cleared
- [ ] Playwright: changing a reminder on an emailed task removes the line (Chromium and WebKit)
- [ ] No hex, OKLCH or raw `font-family` outside `tokens.css`; visible and unclipped at 320 px

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`
- [ ] Screenshot at 375 px for the article

**Dependencies:** T20
**Files:** `src/components/TaskDetail/*`, `src/test/factories.ts`, `e2e/taskdetail.spec.ts`
**Scope:** S

---

## Task 22: Feature B — Part 6 article, README, SPEC and ADR

**Description:** Add **Part 6 · Send email reminders with Power Automate** (Steps continue from Part 5): prerequisites box (Power Automate Premium, Outlook connection, AccelerateON pointer); import the 1.1.0.0 solution and refresh/re-push (reusing Part 5's steps); build the flow in the maker portal inside `CodeApp101` with every trigger, action, OData filter and expression written out; connection references when moving between environments; test it; Verify Part 6; Troubleshooting. Write `docs/adr/0005-reminder-email-flow.md`.

**Acceptance criteria:**
- [ ] Flow spec in the article matches SPEC §10.2: 5-minute recurrence; filter `cb_reminderat le utcNow() and cb_reminderat ge <utcNow − 24 h> and cb_iscompleted eq false and cb_reminderemailsentat eq null`; list-name lookup; mail from Outlook "Send an email (V2)" to the connection owner; stamp update; concurrency 1; time zone via `convertTimeZone`
- [ ] The article states the limits: single-user scope (P5) and the service-account path, five-minute granularity, possible duplicate with the browser notification, and the app link marked **unverified** (O4)
- [ ] Troubleshooting entries: flow finds no rows, Dataverse 403 from the User-level role, mail in junk, time zone off, flow auto-disabled after failures or when its owner leaves
- [ ] Flow screenshots are placeholders in `docs/images/` for Christopher to replace (O3), named and listed
- [ ] README status table, feature list and stack updated; SPEC S3, A4 and Q3 edited to say the email path exists; `CLAUDE.md` current-state section updated; `docs/smoke.md` gains the email-reminder checks
- [ ] Every portal step is marked run or unrun; none claimed as verified that I did not see

**Verification:**
- [ ] `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] Re-read Part 6 against the final column name, filter and field names in the code

**Dependencies:** T20, T21 (T18 for the shared push steps)
**Files:** `docs/how-to-build-a-power-apps-code-app.md`, `docs/adr/0005-reminder-email-flow.md`, `docs/smoke.md`, `docs/images/*`, `README.md`, `SPEC.md`, `CLAUDE.md`
**Scope:** M

---

## Checkpoint E — Phase 2 done **(Christopher)**
- [ ] 1.1.0.0 solution imported, data source refreshed, app built and pushed (Part 5 step 21–22 run for real)
- [ ] Flow built from Part 6 exactly as written; a reminder set 10 minutes ahead emails the owner within 10 minutes; the task shows "Email sent"
- [ ] Changing the reminder re-arms and sends again; completed, reminder-less and over-24-hour-old tasks send nothing; flow off breaks nothing
- [ ] `docs/smoke.md` results recorded; unrun article steps either run or still marked unrun
- [ ] SPEC §10.8 criteria 1–5 true
