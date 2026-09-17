import type { Cb_todolists, Cb_todolistsBase } from "@/generated/models/Cb_todolistsModel";
import type { Cb_todosubtasks, Cb_todosubtasksBase } from "@/generated/models/Cb_todosubtasksModel";
import type {
  Cb_todotasks,
  Cb_todotasksBase,
  Cb_todotaskscb_recurrence,
} from "@/generated/models/Cb_todotasksModel";
import { definedOnly, listDefaults, subtaskDefaults, taskDefaults } from "../defaults";
import type {
  List,
  ListPatch,
  NewList,
  NewSubtask,
  NewTask,
  Recurrence,
  Subtask,
  SubtaskPatch,
  Task,
  TaskPatch,
} from "../repo";

/** A column set to null clears it in Dataverse; the generated types only allow undefined. */
type Clearable<T> = { [K in keyof T]?: T[K] | null };

export type ListRecord = Omit<Cb_todolistsBase, "cb_todolistid">;
export type TaskRecord = Omit<Cb_todotasksBase, "cb_todotaskid">;
export type SubtaskRecord = Omit<Cb_todosubtasksBase, "cb_todosubtaskid">;
export type TaskPatchRecord = Clearable<TaskRecord>;

const ACTIVE = 0;
const LIST_BIND = "cb_todolist_cb_todotask_list@odata.bind";
const PARENT_BIND = "cb_todotask_cb_todotask_recurrenceparent@odata.bind";
const TASK_BIND = "cb_todotask_cb_todosubtask_task@odata.bind";

export const listColumns = [
  "cb_todolistid",
  "cb_name",
  "cb_sortorder",
  "cb_isinbox",
  "cb_isarchived",
];
export const taskColumns = [
  "cb_todotaskid",
  "_cb_list_value",
  "cb_title",
  "cb_notes",
  "cb_duedate",
  "cb_hastime",
  "cb_reminderat",
  "cb_iscompleted",
  "cb_completedon",
  "cb_recurrence",
  "_cb_recurrenceparent_value",
  "cb_sortorder",
];
export const subtaskColumns = [
  "cb_todosubtaskid",
  "_cb_task_value",
  "cb_title",
  "cb_isdone",
  "cb_sortorder",
];

const recurrenceChoices: Record<Recurrence, Cb_todotaskscb_recurrence> = {
  none: 100000000,
  daily: 100000001,
  weekly: 100000002,
  monthly: 100000003,
};

const recurrenceByChoice = new Map(
  Object.entries(recurrenceChoices).map(([name, value]) => [value as number, name as Recurrence]),
);

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the id unchanged if it is a GUID, so it is safe to place in an OData filter or bind path. */
export function odataId(id: string): string {
  if (!GUID.test(id)) throw new Error(`Not a Dataverse id: ${id}`);
  return id;
}

const parseDate = (value: string | null | undefined) => (value ? new Date(value) : null);
const isoOrNull = (value: Date | null) => (value ? value.toISOString() : null);

// ---- Rows to domain ----

export function toList(row: Cb_todolists): List {
  return {
    id: row.cb_todolistid,
    name: row.cb_name,
    sortOrder: row.cb_sortorder ?? 0,
    isInbox: row.cb_isinbox ?? false,
    isArchived: row.cb_isarchived ?? false,
  };
}

export function toTask(row: Cb_todotasks): Task {
  if (!row._cb_list_value) throw new Error(`Task ${row.cb_todotaskid} has no list`);
  return {
    id: row.cb_todotaskid,
    listId: row._cb_list_value,
    title: row.cb_title,
    notes: row.cb_notes ?? "",
    dueDate: parseDate(row.cb_duedate),
    hasTime: row.cb_hastime ?? false,
    reminderAt: parseDate(row.cb_reminderat),
    isCompleted: row.cb_iscompleted ?? false,
    completedOn: parseDate(row.cb_completedon),
    recurrence: recurrenceByChoice.get(Number(row.cb_recurrence)) ?? "none",
    recurrenceParentId: row._cb_recurrenceparent_value ?? null,
    sortOrder: row.cb_sortorder ?? 0,
  };
}

export function toSubtask(row: Cb_todosubtasks): Subtask {
  return {
    id: row.cb_todosubtaskid,
    taskId: row._cb_task_value ?? "",
    title: row.cb_title,
    isDone: row.cb_isdone ?? false,
    sortOrder: row.cb_sortorder ?? 0,
  };
}

// ---- Domain to create payloads ----

export function newListRecord(input: NewList): ListRecord {
  const list = { ...listDefaults, ...definedOnly(input) } as Omit<List, "id">;
  return {
    cb_name: list.name,
    cb_sortorder: list.sortOrder,
    cb_isinbox: list.isInbox,
    cb_isarchived: list.isArchived,
    statecode: ACTIVE,
  };
}

export function newTaskRecord(input: NewTask): TaskRecord {
  const task = { ...taskDefaults, ...definedOnly(input) } as Omit<Task, "id">;
  const record: TaskRecord = {
    [LIST_BIND]: `/cb_todolists(${odataId(task.listId)})`,
    cb_title: task.title,
    cb_notes: task.notes,
    cb_hastime: task.hasTime,
    cb_iscompleted: task.isCompleted,
    cb_recurrence: recurrenceChoices[task.recurrence],
    cb_sortorder: task.sortOrder,
    statecode: ACTIVE,
  };
  if (task.dueDate) record.cb_duedate = task.dueDate.toISOString();
  if (task.reminderAt) record.cb_reminderat = task.reminderAt.toISOString();
  if (task.completedOn) record.cb_completedon = task.completedOn.toISOString();
  if (task.recurrenceParentId) {
    record[PARENT_BIND] = `/cb_todotasks(${odataId(task.recurrenceParentId)})`;
  }
  return record;
}

export function newSubtaskRecord(input: NewSubtask): SubtaskRecord {
  const subtask = { ...subtaskDefaults, ...definedOnly(input) } as Omit<Subtask, "id">;
  return {
    [TASK_BIND]: `/cb_todotasks(${odataId(subtask.taskId)})`,
    cb_title: subtask.title,
    cb_isdone: subtask.isDone,
    cb_sortorder: subtask.sortOrder,
    statecode: ACTIVE,
  };
}

// ---- Domain patches to update payloads: only the columns that changed ----

export function listPatchRecord(patch: ListPatch): Partial<ListRecord> {
  const p = definedOnly(patch);
  const record: Partial<ListRecord> = {};
  if (p.name !== undefined) record.cb_name = p.name;
  if (p.sortOrder !== undefined) record.cb_sortorder = p.sortOrder;
  if (p.isInbox !== undefined) record.cb_isinbox = p.isInbox;
  if (p.isArchived !== undefined) record.cb_isarchived = p.isArchived;
  return record;
}

export function taskPatchRecord(patch: TaskPatch): TaskPatchRecord {
  const p = definedOnly(patch);
  if ("recurrenceParentId" in p) {
    throw new Error("Changing the recurrence parent of an existing task is not supported");
  }
  const record: TaskPatchRecord = {};
  if (p.listId !== undefined) record[LIST_BIND] = `/cb_todolists(${odataId(p.listId)})`;
  if (p.title !== undefined) record.cb_title = p.title;
  if (p.notes !== undefined) record.cb_notes = p.notes;
  if (p.dueDate !== undefined) record.cb_duedate = isoOrNull(p.dueDate);
  if (p.hasTime !== undefined) record.cb_hastime = p.hasTime;
  if (p.reminderAt !== undefined) record.cb_reminderat = isoOrNull(p.reminderAt);
  if (p.isCompleted !== undefined) record.cb_iscompleted = p.isCompleted;
  if (p.completedOn !== undefined) record.cb_completedon = isoOrNull(p.completedOn);
  if (p.recurrence !== undefined) record.cb_recurrence = recurrenceChoices[p.recurrence];
  if (p.sortOrder !== undefined) record.cb_sortorder = p.sortOrder;
  return record;
}

export function subtaskPatchRecord(patch: SubtaskPatch): Partial<SubtaskRecord> {
  const p = definedOnly(patch);
  const record: Partial<SubtaskRecord> = {};
  if (p.title !== undefined) record.cb_title = p.title;
  if (p.isDone !== undefined) record.cb_isdone = p.isDone;
  if (p.sortOrder !== undefined) record.cb_sortorder = p.sortOrder;
  return record;
}
