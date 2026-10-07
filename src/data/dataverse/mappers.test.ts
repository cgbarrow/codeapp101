import { describe, expect, it } from "vitest";
import type { Cb_todolists } from "@/generated/models/Cb_todolistsModel";
import type { Cb_todosubtasks } from "@/generated/models/Cb_todosubtasksModel";
import type { Cb_todotasks } from "@/generated/models/Cb_todotasksModel";
import {
  listPatchRecord,
  newListRecord,
  newSubtaskRecord,
  newTaskRecord,
  odataId,
  subtaskPatchRecord,
  taskPatchRecord,
  toList,
  toSubtask,
  toTask,
} from "./mappers";

const LIST_ID = "11111111-1111-4111-8111-111111111111";
const TASK_ID = "22222222-2222-4222-8222-222222222222";
const PARENT_ID = "33333333-3333-4333-8333-333333333333";
const SUBTASK_ID = "44444444-4444-4444-8444-444444444444";

describe("toList", () => {
  it("maps a Dataverse row to a List", () => {
    const row = {
      cb_todolistid: LIST_ID,
      cb_name: "Work",
      cb_sortorder: 2,
      cb_isinbox: false,
      cb_isarchived: true,
      statecode: 0,
      ownerid: "owner",
    } as Cb_todolists;

    expect(toList(row)).toEqual({
      id: LIST_ID,
      name: "Work",
      sortOrder: 2,
      isInbox: false,
      isArchived: true,
    });
  });

  it("treats null or missing columns as defaults", () => {
    const row = {
      cb_todolistid: LIST_ID,
      cb_name: "Inbox",
      cb_sortorder: null,
    } as unknown as Cb_todolists;

    expect(toList(row)).toEqual({
      id: LIST_ID,
      name: "Inbox",
      sortOrder: 0,
      isInbox: false,
      isArchived: false,
    });
  });
});

describe("toTask", () => {
  it("maps columns, parses ISO dates and converts the recurrence choice", () => {
    const row = {
      cb_todotaskid: TASK_ID,
      _cb_list_value: LIST_ID,
      cb_title: "Call Sam",
      cb_notes: "About the offsite",
      cb_duedate: "2026-09-18T15:00:00Z",
      cb_hastime: true,
      cb_reminderat: "2026-09-18T14:50:00Z",
      cb_reminderemailsentat: "2026-09-18T14:51:00Z",
      cb_iscompleted: true,
      cb_completedon: "2026-09-18T15:05:00Z",
      cb_recurrence: 100000002,
      _cb_recurrenceparent_value: PARENT_ID,
      cb_sortorder: 3,
    } as Cb_todotasks;

    expect(toTask(row)).toEqual({
      id: TASK_ID,
      listId: LIST_ID,
      title: "Call Sam",
      notes: "About the offsite",
      dueDate: new Date("2026-09-18T15:00:00Z"),
      hasTime: true,
      reminderAt: new Date("2026-09-18T14:50:00Z"),
      reminderEmailSentAt: new Date("2026-09-18T14:51:00Z"),
      isCompleted: true,
      completedOn: new Date("2026-09-18T15:05:00Z"),
      recurrence: "weekly",
      recurrenceParentId: PARENT_ID,
      sortOrder: 3,
    });
  });

  it("maps empty columns to null, empty strings and 'none'", () => {
    const row = {
      cb_todotaskid: TASK_ID,
      _cb_list_value: LIST_ID,
      cb_title: "Buy milk",
      cb_notes: null,
      cb_duedate: null,
      cb_recurrence: null,
    } as unknown as Cb_todotasks;

    expect(toTask(row)).toMatchObject({
      notes: "",
      dueDate: null,
      reminderAt: null,
      reminderEmailSentAt: null,
      completedOn: null,
      hasTime: false,
      isCompleted: false,
      recurrence: "none",
      recurrenceParentId: null,
      sortOrder: 0,
    });
  });

  it("maps each recurrence choice value", () => {
    const recurrenceOf = (value: number) =>
      toTask({
        cb_todotaskid: TASK_ID,
        _cb_list_value: LIST_ID,
        cb_title: "x",
        cb_recurrence: value,
      } as Cb_todotasks).recurrence;

    expect([100000000, 100000001, 100000002, 100000003].map(recurrenceOf)).toEqual([
      "none",
      "daily",
      "weekly",
      "monthly",
    ]);
  });

  it("rejects a row without a list, which the schema marks required", () => {
    expect(() => toTask({ cb_todotaskid: TASK_ID, cb_title: "Orphan" } as Cb_todotasks)).toThrow(
      /list/,
    );
  });
});

describe("toSubtask", () => {
  it("maps a Dataverse row to a Subtask", () => {
    const row = {
      cb_todosubtaskid: SUBTASK_ID,
      _cb_task_value: TASK_ID,
      cb_title: "Socks",
      cb_isdone: true,
      cb_sortorder: 1,
    } as Cb_todosubtasks;

    expect(toSubtask(row)).toEqual({
      id: SUBTASK_ID,
      taskId: TASK_ID,
      title: "Socks",
      isDone: true,
      sortOrder: 1,
    });
  });
});

describe("create payloads", () => {
  it("builds a list record with defaults and an active state", () => {
    expect(newListRecord({ name: "Work" })).toEqual({
      cb_name: "Work",
      cb_sortorder: 0,
      cb_isinbox: false,
      cb_isarchived: false,
      statecode: 0,
    });
  });

  it("binds a new task to its list and sends ISO dates and the choice value", () => {
    const record = newTaskRecord({
      listId: LIST_ID,
      title: "Call Sam",
      dueDate: new Date("2026-09-18T15:00:00Z"),
      hasTime: true,
      recurrence: "monthly",
      recurrenceParentId: PARENT_ID,
    });

    expect(record).toEqual({
      "cb_todolist_cb_todotask_list@odata.bind": `/cb_todolists(${LIST_ID})`,
      "cb_todotask_cb_todotask_recurrenceparent@odata.bind": `/cb_todotasks(${PARENT_ID})`,
      cb_title: "Call Sam",
      cb_notes: "",
      cb_duedate: "2026-09-18T15:00:00.000Z",
      cb_hastime: true,
      cb_iscompleted: false,
      cb_recurrence: 100000003,
      cb_sortorder: 0,
      statecode: 0,
    });
  });

  it("omits empty dates and the recurrence parent rather than sending null on create", () => {
    const record = newTaskRecord({ listId: LIST_ID, title: "x" });

    for (const column of [
      "cb_duedate",
      "cb_reminderat",
      "cb_reminderemailsentat",
      "cb_completedon",
      "cb_todotask_cb_todotask_recurrenceparent@odata.bind",
    ]) {
      expect(record).not.toHaveProperty(column);
    }
  });

  it("binds a new subtask to its task", () => {
    expect(newSubtaskRecord({ taskId: TASK_ID, title: "Socks" })).toEqual({
      "cb_todotask_cb_todosubtask_task@odata.bind": `/cb_todotasks(${TASK_ID})`,
      cb_title: "Socks",
      cb_isdone: false,
      cb_sortorder: 0,
      statecode: 0,
    });
  });
});

describe("update payloads send only changed columns", () => {
  it("maps a list patch", () => {
    expect(listPatchRecord({ name: "Office" })).toEqual({ cb_name: "Office" });
    expect(listPatchRecord({ isArchived: true, sortOrder: 5 })).toEqual({
      cb_isarchived: true,
      cb_sortorder: 5,
    });
  });

  it("maps a task toggle to two columns", () => {
    const completedOn = new Date("2026-09-17T10:00:00Z");

    expect(taskPatchRecord({ isCompleted: true, completedOn })).toEqual({
      cb_iscompleted: true,
      cb_completedon: "2026-09-17T10:00:00.000Z",
    });
  });

  it("clears dates with null and ignores undefined fields", () => {
    expect(taskPatchRecord({ dueDate: null, title: undefined })).toEqual({ cb_duedate: null });
  });

  it("rebinds a task moved to another list", () => {
    expect(taskPatchRecord({ listId: LIST_ID })).toEqual({
      "cb_todolist_cb_todotask_list@odata.bind": `/cb_todolists(${LIST_ID})`,
    });
  });

  it("maps notes, time flags, reminders, recurrence and order", () => {
    expect(
      taskPatchRecord({
        notes: "n",
        hasTime: false,
        reminderAt: new Date("2026-09-18T09:00:00Z"),
        recurrence: "daily",
        sortOrder: 7,
      }),
    ).toEqual({
      cb_notes: "n",
      cb_hastime: false,
      cb_reminderat: "2026-09-18T09:00:00.000Z",
      cb_reminderemailsentat: null,
      cb_recurrence: 100000001,
      cb_sortorder: 7,
    });
  });

  it("clears the email-sent time in the same patch when the reminder changes", () => {
    expect(taskPatchRecord({ reminderAt: new Date("2026-09-18T09:00:00Z") })).toEqual({
      cb_reminderat: "2026-09-18T09:00:00.000Z",
      cb_reminderemailsentat: null,
    });
  });

  it("clears the email-sent time when the reminder is cleared", () => {
    expect(taskPatchRecord({ reminderAt: null })).toEqual({
      cb_reminderat: null,
      cb_reminderemailsentat: null,
    });
  });

  it("omits the email-sent column when the patch does not touch the reminder", () => {
    expect(taskPatchRecord({ title: "x", dueDate: null })).not.toHaveProperty(
      "cb_reminderemailsentat",
    );
  });

  it("sends an explicit email-sent time on create and in a patch that leaves the reminder alone", () => {
    const sentAt = new Date("2026-09-18T09:01:00Z");

    expect(
      newTaskRecord({ listId: LIST_ID, title: "x", reminderEmailSentAt: sentAt }),
    ).toHaveProperty("cb_reminderemailsentat", "2026-09-18T09:01:00.000Z");
    expect(taskPatchRecord({ reminderEmailSentAt: sentAt })).toEqual({
      cb_reminderemailsentat: "2026-09-18T09:01:00.000Z",
    });
  });

  it("refuses to change the recurrence parent, which needs an association call", () => {
    expect(() => taskPatchRecord({ recurrenceParentId: null })).toThrow(/recurrence parent/i);
  });

  it("maps a subtask patch", () => {
    expect(subtaskPatchRecord({ isDone: true, title: "Wool socks", sortOrder: 2 })).toEqual({
      cb_isdone: true,
      cb_title: "Wool socks",
      cb_sortorder: 2,
    });
  });
});

describe("odataId", () => {
  it("accepts a GUID", () => {
    expect(odataId(LIST_ID)).toBe(LIST_ID);
  });

  it("rejects anything else, so an id can never alter an OData filter", () => {
    expect(() => odataId("1 or 1 eq 1")).toThrow(/Not a Dataverse id/);
    expect(() => odataId("seed-inbox")).toThrow(/Not a Dataverse id/);
  });
});
