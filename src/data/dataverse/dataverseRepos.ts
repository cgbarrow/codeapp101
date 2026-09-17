import type { IOperationResult } from "@microsoft/power-apps/data";
import type { IGetAllOptions, IGetOptions } from "@/generated/models/CommonModels";
import type { Cb_todolists } from "@/generated/models/Cb_todolistsModel";
import type { Cb_todosubtasks } from "@/generated/models/Cb_todosubtasksModel";
import type { Cb_todotasks } from "@/generated/models/Cb_todotasksModel";
import type { Repos } from "../repo";
import {
  type ListRecord,
  type SubtaskRecord,
  type TaskRecord,
  listColumns,
  listPatchRecord,
  newListRecord,
  newSubtaskRecord,
  newTaskRecord,
  odataId,
  subtaskColumns,
  subtaskPatchRecord,
  taskColumns,
  taskPatchRecord,
  toList,
  toSubtask,
  toTask,
} from "./mappers";

/** The subset of a generated `*Service` class the repositories use. */
export type TableService<TRow, TRecord> = {
  create(record: TRecord): Promise<IOperationResult<TRow>>;
  update(id: string, changedFields: Partial<TRecord>): Promise<IOperationResult<TRow>>;
  delete(id: string): Promise<void>;
  get(id: string, options?: IGetOptions): Promise<IOperationResult<TRow>>;
  getAll(options?: IGetAllOptions): Promise<IOperationResult<TRow[]>>;
};

export type DataverseServices = {
  lists: TableService<Cb_todolists, ListRecord>;
  tasks: TableService<Cb_todotasks, TaskRecord>;
  subtasks: TableService<Cb_todosubtasks, SubtaskRecord>;
};

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    throw result.error ?? new Error("Dataverse reported a failed operation without an error");
  }
  return result.data;
}

async function getAllPages<TRow>(
  service: TableService<TRow, unknown>,
  options: IGetAllOptions,
): Promise<TRow[]> {
  const rows: TRow[] = [];
  let skipToken: string | undefined;
  do {
    const result = await service.getAll({ ...options, skipToken });
    rows.push(...unwrap(result));
    skipToken = result.skipToken;
  } while (skipToken);
  return rows;
}

/**
 * Creates and updates are followed by a read with an explicit select, so lookup columns such
 * as `_cb_list_value` are always present whatever the create response contains.
 */
async function writeThenRead<TRow>(
  service: TableService<TRow, unknown>,
  write: Promise<IOperationResult<TRow>>,
  primaryKey: keyof TRow,
  select: string[],
  knownId?: string,
): Promise<TRow> {
  const written = unwrap(await write);
  const id = knownId ?? String(written[primaryKey]);
  return unwrap(await service.get(id, { select }));
}

/** Repositories over the generated Dataverse services. */
export function createDataverseRepos(services: DataverseServices): Repos {
  const { lists, tasks, subtasks } = services;

  return {
    lists: {
      getAll: async () =>
        (await getAllPages(lists, { select: listColumns, orderBy: ["cb_sortorder asc"] })).map(
          toList,
        ),

      create: async (input) =>
        toList(
          await writeThenRead(
            lists,
            lists.create(newListRecord(input)),
            "cb_todolistid",
            listColumns,
          ),
        ),

      update: async (id, patch) =>
        toList(
          await writeThenRead(
            lists,
            lists.update(odataId(id), listPatchRecord(patch)),
            "cb_todolistid",
            listColumns,
            id,
          ),
        ),

      delete: async (id) => {
        await lists.delete(odataId(id));
      },
    },

    tasks: {
      getByList: async (listId) =>
        (
          await getAllPages(tasks, {
            select: taskColumns,
            filter: `_cb_list_value eq ${odataId(listId)}`,
            orderBy: ["cb_sortorder asc"],
          })
        ).map(toTask),

      getOpenDueBefore: async (end) =>
        (
          await getAllPages(tasks, {
            select: taskColumns,
            filter: `cb_iscompleted eq false and cb_duedate lt ${end.toISOString()}`,
            orderBy: ["cb_duedate asc"],
          })
        ).map(toTask),

      create: async (input) =>
        toTask(
          await writeThenRead(
            tasks,
            tasks.create(newTaskRecord(input)),
            "cb_todotaskid",
            taskColumns,
          ),
        ),

      update: async (id, patch) =>
        toTask(
          await writeThenRead(
            tasks,
            // Null clears a column in Dataverse; the generated type does not model that.
            tasks.update(odataId(id), taskPatchRecord(patch) as Partial<TaskRecord>),
            "cb_todotaskid",
            taskColumns,
            id,
          ),
        ),

      delete: async (id) => {
        await tasks.delete(odataId(id));
      },
    },

    subtasks: {
      getByTask: async (taskId) =>
        (
          await getAllPages(subtasks, {
            select: subtaskColumns,
            filter: `_cb_task_value eq ${odataId(taskId)}`,
            orderBy: ["cb_sortorder asc"],
          })
        ).map(toSubtask),

      create: async (input) =>
        toSubtask(
          await writeThenRead(
            subtasks,
            subtasks.create(newSubtaskRecord(input)),
            "cb_todosubtaskid",
            subtaskColumns,
          ),
        ),

      update: async (id, patch) =>
        toSubtask(
          await writeThenRead(
            subtasks,
            subtasks.update(odataId(id), subtaskPatchRecord(patch)),
            "cb_todosubtaskid",
            subtaskColumns,
            id,
          ),
        ),

      delete: async (id) => {
        await subtasks.delete(odataId(id));
      },
    },
  };
}
