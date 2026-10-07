# Dataverse setup for CodeApp101

Environment: your own, with ID `Default-<tenant-id>` (the bare GUID is the tenant ID).
Solution: **CodeApp101**, publisher prefix **cb**. Schema source of truth: [`solution/generate.py`](../solution/generate.py).

Two paths. Try Path A first; it takes about two minutes. Fall back to Path B only if the import is rejected.

---

## Before either path

1. **Confirm you hold the System Administrator role** on the environment (admin center → environment → Access → Users → Manage security roles, or → Membership). The import creates tables and fails without it. Most developers already have this role.
2. **Enable code apps** on the environment: [Power Platform admin center](https://admin.powerplatform.microsoft.com) → Manage → Environments → *your environment* → Settings → Product → Features → **Power Apps code apps** → toggle **Enable code apps** on → Save.
3. Confirm your account has a **Power Apps Premium** licence (required to run code apps).
4. Publisher check done 2026-09-16: the environment only has *CDS Default Publisher (Cr04d74)* and *Default Publisher for <org>*. Neither uses prefix `cb`, so the import creates **CodeApp101 Publisher** (unique name `CodeApp101Publisher`, prefix `cb`). Do not pick a default publisher; that would change every schema name.

---

## Path A — Import the generated solution package

1. Go to [make.powerapps.com](https://make.powerapps.com), pick the environment (top right), then **Solutions** in the left nav.
2. Click **Import solution** → **Browse** → choose `solution/CodeApp101_1_0_0_0.zip` from this repo → **Next**.
3. The details page should show *CodeApp101*, version 1.0.0.0, publisher *CodeApp101 Publisher* (or your existing `cb` publisher). Click **Import**.
4. Wait for the green "Solution imported successfully" banner. Open **CodeApp101** and confirm **Tables** lists Todo List, Todo Task, Todo Subtask and **Security roles** lists *Todo User*.
5. Open **Todo Task → Columns** and confirm you can see *List* (lookup), *Due Date*, *Recurrence* (choice), *Recurrence Parent* (lookup). Open **Todo Subtask → Columns** and confirm *Task* (lookup).
6. Continue to **Assign the role** below.

If the import fails, click **Download log file**, save it as `docs/import-log.xml`, and paste the first error line into the chat. Then use Path B.

---

## Path B — Manual fallback (click-by-click)

All steps in [make.powerapps.com](https://make.powerapps.com) with the correct environment selected.

### B1. Publisher and solution
1. Solutions → **New solution**. Display name `CodeApp101`, Name `CodeApp101`.
2. Publisher: **+ Publisher** → Display name `CodeApp101 Publisher`, Name `CodeApp101Publisher`, Prefix `cb`, Choice value prefix `10000` → Save.
3. Version `1.0.0.0` → **Create**. Open the solution; do everything below from inside it so components land in the solution.

### B2. Table: Todo List
1. **+ New → Table → Table (advanced)**. Display name `Todo List`, Plural `Todo Lists`. Expand **Advanced options**: Schema name must read `cb_TodoList`; Record ownership **User or team**; Primary column display name `Name`, schema `cb_Name`. **Save**.
2. Open the table → **Columns → + New column**, one at a time (Display name · Data type · Schema name · extras):
   - `Sort Order` · Number → Whole number · `cb_SortOrder`
   - `Is Inbox` · Choice → Yes/no · `cb_IsInbox` · default No
   - `Is Archived` · Choice → Yes/no · `cb_IsArchived` · default No
3. Edit the primary column `Name`: max length **100**, Required.

### B3. Table: Todo Task
1. **+ New → Table → Table (advanced)**. Display `Todo Task`, plural `Todo Tasks`, schema `cb_TodoTask`, ownership **User or team**, primary column `Title` / `cb_Title`. **Save**.
2. Columns:
   - `Title` (primary) · max length **400**, Required
   - `Notes` · Text → Multiple lines of text · `cb_Notes` · max 4000
   - `List` · Lookup → Lookup · `cb_List` · Related table **Todo List** · Required · under Advanced set Relationship name `cb_todolist_cb_todotask_list`
   - `Due Date` · Date and time → Date and time · `cb_DueDate` · Behavior **User local**
   - `Has Time` · Choice → Yes/no · `cb_HasTime` · default No
   - `Reminder At` · Date and time → Date and time · `cb_ReminderAt` · User local
   - `Is Completed` · Choice → Yes/no · `cb_IsCompleted` · default No
   - `Completed On` · Date and time → Date and time · `cb_CompletedOn` · User local
   - `Recurrence` · Choice → Choice · `cb_Recurrence` · **local** choice with values exactly: `None` = 100000000, `Daily` = 100000001, `Weekly` = 100000002, `Monthly` = 100000003 · default None
   - `Recurrence Parent` · Lookup → Lookup · `cb_RecurrenceParent` · Related table **Todo Task** (self) · not required · Relationship name `cb_todotask_cb_todotask_recurrenceparent`
   - `Sort Order` · Number → Whole number · `cb_SortOrder`
3. **Relationships** tab → open `cb_todolist_cb_todotask_list` → Advanced → set **Type of behavior** to *Parental* (Delete: Cascade All). For the self relationship keep *Referential, Remove Link*.

### B4. Table: Todo Subtask
1. **+ New → Table → Table (advanced)**. Display `Todo Subtask`, plural `Todo Subtasks`, schema `cb_TodoSubtask`, ownership **User or team**, primary column `Title` / `cb_Title` (max 400). **Save**.
2. Columns:
   - `Task` · Lookup · `cb_Task` · Related table **Todo Task** · Required · Relationship name `cb_todotask_cb_todosubtask_task` · behavior **Parental**
   - `Is Done` · Yes/no · `cb_IsDone` · default No
   - `Sort Order` · Whole number · `cb_SortOrder`

### B5. Security role: Todo User
1. Inside the solution: **+ New → Security → Security role**. Name `Todo User` → Save.
2. Search each of *Todo List*, *Todo Task*, *Todo Subtask* and set **Create, Read, Write, Delete, Append, Append To, Assign, Share** to **User** (the single quarter-circle). Save and close.

### B6. Publish and export
1. **Publish all customizations**.
2. Solutions → select CodeApp101 → **Export solution** → Unmanaged → download. Save the file as `solution/CodeApp101_1_0_0_0.zip` in this repo (replacing the generated one) and tell me; I will unpack it into `solution/src/` so Git has the real schema.

---

## Assign the role (both paths)

1. [Power Platform admin center](https://admin.powerplatform.microsoft.com) → Manage → Environments → *your environment* → **Users** → **See all** → select yourself → **Manage security roles** → tick **Todo User** → Save.
2. Repeat for any second test account you will use in Task 16.

## Verify

1. make.powerapps.com → Tables → **Todo List** → **Data** tab → **+ New row** → Name `Inbox`, Is Inbox `Yes` → Save. If that succeeds, the schema and role are working.
2. Delete the test row afterwards (the app creates the real Inbox on first run).

## Import history

- 2026-09-16 attempt 1: rejected, `prvCreateEntity` missing. Fixed by adding the account to the environment's System Administrator membership (admin center → environment → Membership).
- 2026-09-16 attempt 2: tables and views created; failed at relationship `cb_todolist_cb_todotask_list` with "NavPaneDisplayOption attribute is required for the Referencing Role" (0x80060898). Cause: relationship role types were swapped in the generator. Fixed; zip regenerated. Because unmanaged imports are not transactional, the three tables already existed in the environment; the next import updated them and added the relationships and role.
- 2026-09-16 attempt 3: **success**.

Record which path you used and the date here:

- [x] Path A (import) — date: 2026-09-16 (attempt 3, after the relationship-role fix). Tables, relationships and Todo User role confirmed in the solution; role assigned to Christopher.
- [ ] Path B (manual) — not needed
