# Smoke checks

Manual checks against the real environment. Tests never touch Dataverse; these do.

## Dataverse repositories (task 4)

**How:** run `npm run dev:smoke`, open the printed **Local Play** URL in the browser profile signed in to the tenant, and click each step in the **Dataverse smoke test** panel in order. Check the maker portal (Tables → Todo Lists / Todo Tasks → Data) between steps. The panel deletes everything it creates.

**17 September 2026:** passed. Run by Christopher as `Mackensen5659@vy7kt.onmicrosoft.com` against `Default-dc087386-56cb-4425-82f3-4b2dd04d62d8`.

| Step | Logged result | Outcome |
|---|---|---|
| Create list | `Created list "Smoke test 2026-09-17T12:45:05.098Z" (957d6f9b-95b2-f111-aaac-7c1e5201b9cd)` | Pass |
| Create task | `Created task 977d6f9b-95b2-f111-aaac-7c1e5201b9cd in list 957d6f9b-95b2-f111-aaac-7c1e5201b9cd` | Pass: the list lookup was bound and read back |
| Mark task complete | `Marked task complete at 2026-09-17T12:45:11.000Z` | Pass |
| Delete task | `Deleted task` | Pass |
| Delete list | `Deleted list` | Pass |

The panel's log confirms each write succeeded and read back. Row-by-row checks in the maker portal between steps were part of the instructions but were not reported separately.

Observed: Dataverse stored `cb_completedon` without its milliseconds, and the read-back value ends in `.000Z`. Nothing depends on sub-second precision.

## Where each acceptance criterion is proved (task 15)

Automated unless the row says otherwise. Run everything with `npm test` and `npm run e2e`.

| SPEC | Criterion | Proof |
|---|---|---|
| S1 | `n`, type, Enter creates a task; date parsed from the text; chip clears the parse; optimistic insert | `src/features/quickadd/parseQuickAdd.test.ts` (38 phrases), `QuickAdd.test.tsx`, `e2e/quickadd.spec.ts` (times Enter→row under 100 ms), `e2e/flow.spec.ts` |
| S2 | Refetch on focus, visibility and every 60 s; retries; no horizontal scroll at six widths | `src/data/queryClient.test.ts`, `e2e/sync.spec.ts` (two tabs), `e2e/shell.spec.ts` (320–1440 px) |
| S3 | Due date, optional time, reminder offsets; overdue distinct and sorted first; notification within 30 s | `computeReminderAt.test.ts`, `scheduler.test.ts`, `orderTasks.test.ts`, `TaskDetail.test.tsx`, `e2e/taskdetail.spec.ts`, `e2e/reminders.spec.ts` |
| S4 | Two levels of navigation, inline detail, 200 ms tick with 3 s Undo, Hallmark gates, keyboard set | `AppShell.test.tsx`, `Checkmark.test.tsx`, `TaskList.test.tsx`, `useKeyboardShortcuts.test.tsx`, `e2e/keyboard.spec.ts`, Hallmark audit below |
| S5 | Create, rename, reorder, archive; Inbox automatic and undeletable; delete asks; open counts | `ListNav.test.tsx`, `ensureInbox.test.ts`, `deleteList.test.ts`, `e2e/flow.spec.ts` (move to Inbox) |
| S6 | Daily/weekly/monthly with month-end clamping; next instance on completion; stop repeating | `nextOccurrence.test.ts`, `completeRecurring.test.ts`, `e2e/recurrence.spec.ts` |
| S7 | Up to 50 subtasks, reorderable, row progress, parent stays open | `SubtaskList.test.tsx`, `TaskRow.test.tsx` |
| S8 | Today groups overdue then today across lists, is the landing view, remembers the last view | `selectToday.test.ts` (midnight and both DST changes), `lastView.test.ts`, `TodayRoute.test.tsx`, `e2e/today.spec.ts` |

Criteria that can only be proved against the tenant — a published app, a second user, a phone and a
desktop side by side — are the checklist below, run in task 16.

## Published app (task 16)

Run after `pa app push` and `pa app share`. Record the date, the browser and the outcome in the
Result column, and copy any error text verbatim.

**Setup:** desktop browser signed in as Christopher; phone browser signed in as the second test user
holding only the `Todo User` role; both open the app URL from make.powerapps.com.

| # | Check | How | Result |
|---|---|---|---|
| 1 | The second user can open the app | Sign in as the test user, open the app URL. Expect the Today view, not a permission error | |
| 2 | Capture takes under five seconds | From app focus: `n`, type `Buy milk on Friday`, Enter. Time it. Expect a task titled "Buy milk" due next Friday | |
| 3 | Sync within 60 s and at once on focus | Complete a task on the phone. Watch the desktop tab without touching it (≤ 60 s), then click into it | |
| 4 | Today is the landing view and lists only overdue and due-today work | Open the app cold. Check nothing dated later appears | |
| 5 | Recurrence | Complete a weekly task. Expect a new instance dated +7 days with its subtasks unticked | |
| 6 | Reminder fires | Set a reminder one minute ahead, grant permission, keep the tab open. **Expect this to fail inside the Power Apps player:** notifications are refused in a cross-origin iframe. Record what the sidebar row says | |
| 7 | No horizontal scroll at 320 px | Desktop browser at 320 px wide, and the phone in portrait | |
| 8 | Writes reach Dataverse | After the checks above, look at Tables → Todo Tasks → Data in the maker portal | |
| 9 | A failed write is recoverable | Turn the network off, tick a task, turn it back on, press Retry in the toast | |
| 10 | Delete and Undo | Delete a task, press Undo, confirm the task and its subtasks come back | |

Anything that fails goes into the how-to article's troubleshooting section with its exact error text.
