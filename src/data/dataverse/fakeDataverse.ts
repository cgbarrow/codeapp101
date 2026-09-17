import type { IOperationResult } from "@microsoft/power-apps/data";
import type { IGetAllOptions, IGetOptions } from "@/generated/models/CommonModels";
import type { DataverseServices, TableService } from "./dataverseRepos";

/**
 * An in-memory stand-in for the generated Dataverse services, for tests only. It is strict
 * where Dataverse or the SPEC is strict: reads must pass `select`, filters must use the few
 * shapes the repositories send, lookups are written through `@odata.bind`, and deletes
 * cascade the way the CodeApp101 relationships do.
 */
type Row = Record<string, unknown>;

type TableSpec = {
  primaryKey: string;
  binds: Record<string, { column: string; entitySet: string }>;
};

const tables: Record<keyof DataverseServices, TableSpec> = {
  lists: { primaryKey: "cb_todolistid", binds: {} },
  tasks: {
    primaryKey: "cb_todotaskid",
    binds: {
      "cb_todolist_cb_todotask_list@odata.bind": {
        column: "_cb_list_value",
        entitySet: "cb_todolists",
      },
      "cb_todotask_cb_todotask_recurrenceparent@odata.bind": {
        column: "_cb_recurrenceparent_value",
        entitySet: "cb_todotasks",
      },
    },
  },
  subtasks: {
    primaryKey: "cb_todosubtaskid",
    binds: {
      "cb_todotask_cb_todosubtask_task@odata.bind": {
        column: "_cb_task_value",
        entitySet: "cb_todotasks",
      },
    },
  },
};

const ok = <T>(data: T): IOperationResult<T> => ({ success: true, data });
const notFound = <T>(id: string): IOperationResult<T> => ({
  success: false,
  data: undefined as T,
  error: new Error(`Record ${id} does not exist`),
});

function project(row: Row, select: string[] | undefined): Row {
  if (!select?.length) throw new Error("Fake Dataverse: always pass select");
  return Object.fromEntries(select.map((column) => [column, row[column] ?? null]));
}

function matches(row: Row, filter: string | undefined): boolean {
  if (!filter) return true;
  return filter.split(" and ").every((clause) => {
    const eq = clause.match(/^(\w+) eq (true|false|[0-9a-f-]{36})$/i);
    if (eq) {
      const expected = eq[2] === "true" ? true : eq[2] === "false" ? false : eq[2];
      return (row[eq[1]] ?? (typeof expected === "boolean" ? false : null)) === expected;
    }
    const lt = clause.match(/^(\w+) lt (\S+)$/);
    if (lt) {
      const value = row[lt[1]];
      return typeof value === "string" && new Date(value).getTime() < new Date(lt[2]).getTime();
    }
    throw new Error(`Fake Dataverse: unsupported filter clause "${clause}"`);
  });
}

function compare(orderBy: string[] | undefined) {
  return (a: Row, b: Row) => {
    for (const term of orderBy ?? []) {
      const [column, direction] = term.split(" ");
      const x = a[column] as string | number | null;
      const y = b[column] as string | number | null;
      if (x === y) continue;
      const order = x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
      return direction === "desc" ? -order : order;
    }
    return 0;
  };
}

export function createFakeDataverse({ pageSize = 5000 } = {}): DataverseServices {
  const stores: Record<keyof DataverseServices, Map<string, Row>> = {
    lists: new Map(),
    tasks: new Map(),
    subtasks: new Map(),
  };

  function applyRecord(name: keyof DataverseServices, row: Row, record: Row) {
    for (const [key, value] of Object.entries(record)) {
      const bind = tables[name].binds[key];
      if (!bind) {
        row[key] = value;
        continue;
      }
      const match = String(value).match(/^\/(\w+)\(([0-9a-f-]{36})\)$/i);
      if (!match || match[1] !== bind.entitySet) {
        throw new Error(`Fake Dataverse: bad bind ${key}: ${String(value)}`);
      }
      row[bind.column] = match[2];
    }
  }

  function cascadeDelete(name: keyof DataverseServices, id: string) {
    stores[name].delete(id);
    if (name === "lists") {
      for (const task of [...stores.tasks.values()]) {
        if (task._cb_list_value === id) cascadeDelete("tasks", task.cb_todotaskid as string);
      }
    }
    if (name === "tasks") {
      for (const subtask of [...stores.subtasks.values()]) {
        if (subtask._cb_task_value === id)
          stores.subtasks.delete(subtask.cb_todosubtaskid as string);
      }
      for (const task of stores.tasks.values()) {
        if (task._cb_recurrenceparent_value === id) task._cb_recurrenceparent_value = null;
      }
    }
  }

  function service(name: keyof DataverseServices): TableService<Row, Row> {
    const store = stores[name];
    const { primaryKey } = tables[name];

    return {
      async create(record) {
        if (record.statecode === undefined)
          throw new Error("Fake Dataverse: statecode is required");
        const row: Row = { [primaryKey]: crypto.randomUUID() };
        applyRecord(name, row, record);
        store.set(row[primaryKey] as string, row);
        return ok({ ...row });
      },
      async update(id, changedFields) {
        const row = store.get(id);
        if (!row) return notFound(id);
        applyRecord(name, row, changedFields);
        return ok({ ...row });
      },
      async delete(id) {
        if (!store.has(id)) throw new Error(`Record ${id} does not exist`);
        cascadeDelete(name, id);
      },
      async get(id, options?: IGetOptions) {
        const row = store.get(id);
        return row ? ok(project(row, options?.select)) : notFound(id);
      },
      async getAll(options?: IGetAllOptions) {
        const rows = [...store.values()]
          .filter((row) => matches(row, options?.filter))
          .sort(compare(options?.orderBy));
        const start = Number(options?.skipToken ?? 0);
        const page = rows
          .slice(start, start + pageSize)
          .map((row) => project(row, options?.select));
        const next = start + pageSize;
        return { ...ok(page), skipToken: next < rows.length ? String(next) : undefined };
      },
    };
  }

  return {
    lists: service("lists"),
    tasks: service("tasks"),
    subtasks: service("subtasks"),
  } as unknown as DataverseServices;
}
