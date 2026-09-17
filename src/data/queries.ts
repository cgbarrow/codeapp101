import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { deleteList, type DeleteListOptions } from "@/features/lists/deleteList";
import { ensureInbox } from "@/features/lists/ensureInbox";
import type { SortOrderChange } from "@/features/lists/reorderLists";
import {
  buildNextInstance,
  createNextInstance,
  removeNextInstance,
} from "@/features/recurrence/completeRecurring";
import { orderCompletedTasks } from "@/features/tasks/orderTasks";
import { definedOnly, listDefaults, subtaskDefaults, taskDefaults } from "./defaults";
import { queryKeys } from "./keys";
import type {
  List,
  ListPatch,
  NewList,
  NewSubtask,
  NewTask,
  Subtask,
  SubtaskPatch,
  Task,
  TaskPatch,
} from "./repo";
import { useRepos } from "./useRepos";

type Snapshot<T> = Array<[QueryKey, T | undefined]>;

let optimisticCounter = 0;
const optimisticId = () => `optimistic-${++optimisticCounter}`;

const bySortOrder = (a: { sortOrder: number }, b: { sortOrder: number }) =>
  a.sortOrder - b.sortOrder;

function startOfTomorrow(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Cancels in-flight fetches under `queryKey`, snapshots every matching cache, then rewrites them. */
async function rewriteCaches<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  rewrite: (data: T, key: QueryKey) => T,
): Promise<Snapshot<T>> {
  await queryClient.cancelQueries({ queryKey });
  const snapshot = queryClient.getQueriesData<T>({ queryKey });
  for (const [key, data] of snapshot) {
    if (data !== undefined) queryClient.setQueryData<T>(key, rewrite(data, key));
  }
  return snapshot;
}

function restoreCaches<T>(queryClient: QueryClient, snapshot: Snapshot<T> | undefined) {
  for (const [key, data] of snapshot ?? []) queryClient.setQueryData(key, data);
}

/**
 * Refetches task caches once the last task write settles. Refetching after an earlier write while a
 * later one is still pending would briefly show the earlier state, such as a completion that the
 * user has already undone.
 */
function invalidateTasksWhenIdle(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: queryKeys.tasks }) > 1) return;
  return queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
}

function listIdOfTaskCache(key: QueryKey): string | null {
  return key[1] === "list" ? (key[2] as string) : null;
}

// ---- Queries ----

export function useLists() {
  const { lists } = useRepos();
  return useQuery({ queryKey: queryKeys.lists, queryFn: () => lists.getAll() });
}

/**
 * The user's Inbox, created on first run if they have none. Every consumer shares one query, and
 * `ensureInbox` shares one attempt per repository, so the Inbox is created at most once.
 */
export function useInbox() {
  const repos = useRepos();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.inbox,
    queryFn: async () => {
      const inbox = await ensureInbox(repos.lists);
      const cached = queryClient.getQueryData<List[]>(queryKeys.lists);
      if (cached && !cached.some((list) => list.id === inbox.id)) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.lists });
      }
      return inbox;
    },
    staleTime: Infinity,
  });
}

export type TaskCount = { open: number; total: number };

/** Open and total task counts keyed by list id. A list is absent until its tasks have loaded. */
export function useTaskCounts(listIds: readonly string[]): Record<string, TaskCount> {
  const { tasks } = useRepos();
  return useQueries({
    queries: listIds.map((listId) => ({
      queryKey: queryKeys.tasksByList(listId),
      queryFn: () => tasks.getByList(listId),
    })),
    combine: (results) => {
      const counts: Record<string, TaskCount> = {};
      results.forEach((result, index) => {
        if (result.data) {
          counts[listIds[index]] = {
            open: result.data.filter((task) => !task.isCompleted).length,
            total: result.data.length,
          };
        }
      });
      return counts;
    },
  });
}

/** Completed tasks across the given lists, most recently completed first. */
export function useCompletedTasks(listIds: readonly string[]) {
  const { tasks } = useRepos();
  return useQueries({
    queries: listIds.map((listId) => ({
      queryKey: queryKeys.tasksByList(listId),
      queryFn: () => tasks.getByList(listId),
    })),
    combine: (results) => ({
      tasks: orderCompletedTasks(results.flatMap((result) => result.data ?? [])),
      isPending: results.some((result) => result.isPending),
      isError: results.some((result) => result.isError),
      refetch: () => Promise.all(results.map((result) => result.refetch())),
    }),
  });
}

export function useTasks(listId: string) {
  const { tasks } = useRepos();
  return useQuery({
    queryKey: queryKeys.tasksByList(listId),
    queryFn: () => tasks.getByList(listId),
  });
}

/** Open tasks due before tomorrow in any list. Grouping into Overdue and Today is task 10. */
export function useTodayTasks(now = new Date()) {
  const { tasks } = useRepos();
  const end = startOfTomorrow(now);
  return useQuery({
    queryKey: queryKeys.tasksDueBefore(end),
    queryFn: () => tasks.getOpenDueBefore(end),
  });
}

// ---- Task mutations ----

/** A task to create, optionally with subtasks, as when Undo restores a deleted task. */
export type CreateTaskInput = NewTask & { subtasks?: Array<Omit<NewSubtask, "taskId">> };

export function useCreateTask() {
  const { tasks, subtasks: subtaskRepo } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.tasks,
    // Subtasks are created inside the mutation, so they are restored even if the caller unmounts.
    mutationFn: async ({ subtasks = [], ...input }: CreateTaskInput) => {
      const saved = await tasks.create(input);
      for (const subtask of subtasks) await subtaskRepo.create({ ...subtask, taskId: saved.id });
      return saved;
    },
    onMutate: async (input) => {
      const fields: Partial<CreateTaskInput> = { ...input };
      delete fields.subtasks;
      const placeholder = {
        ...taskDefaults,
        ...definedOnly(fields),
        id: optimisticId(),
      } as Task;
      const snapshot = await rewriteCaches<Task[]>(
        queryClient,
        queryKeys.tasksByList(input.listId),
        (data) => [...data, placeholder].sort(bySortOrder),
      );
      return { snapshot, placeholderId: placeholder.id };
    },
    onSuccess: (saved, _input, context) => {
      for (const [key, data] of queryClient.getQueriesData<Task[]>({ queryKey: queryKeys.tasks })) {
        if (data?.some((task) => task.id === context.placeholderId)) {
          queryClient.setQueryData<Task[]>(
            key,
            data.map((task) => (task.id === context.placeholderId ? saved : task)),
          );
        }
      }
    },
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  });
}

export type UpdateTaskInput = { id: string; patch: TaskPatch };

export function useUpdateTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.tasks,
    mutationFn: ({ id, patch }: UpdateTaskInput) => tasks.update(id, patch),
    onMutate: async ({ id, patch }) => ({
      snapshot: await applyTaskPatch(queryClient, id, patch),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  });
}

export type ToggleTaskInput = {
  id: string;
  isCompleted: boolean;
  /** Reopening as Undo of a completion: also removes the repeat instance that completion created. */
  undo?: boolean;
};

/**
 * Completes or reopens a task. Completing a repeating task also creates its next instance, shown
 * at once as a placeholder unless the task already has one.
 */
export function useToggleTask() {
  const repos = useRepos();
  const queryClient = useQueryClient();
  const patchFor = (isCompleted: boolean): TaskPatch => ({
    isCompleted,
    completedOn: isCompleted ? new Date() : null,
  });

  return useMutation({
    mutationKey: queryKeys.tasks,
    // One write at a time, so a completion and its undo reach the server in order.
    scope: { id: "toggle-task" },
    mutationFn: async ({ id, isCompleted, undo }: ToggleTaskInput) => {
      const saved = await repos.tasks.update(id, patchFor(isCompleted));
      if (isCompleted) await createNextInstance(repos, saved, new Date());
      else if (undo) await removeNextInstance(repos, saved);
      return saved;
    },
    onMutate: async ({ id, isCompleted, undo }) => {
      const cached = queryClient
        .getQueriesData<Task[]>({ queryKey: queryKeys.tasks })
        .flatMap(([, data]) => data ?? []);
      const existing = cached.find((task) => task.id === id);
      const snapshot = await applyTaskPatch(queryClient, id, patchFor(isCompleted));

      if (existing && isCompleted && !cached.some((task) => task.recurrenceParentId === id)) {
        const next = buildNextInstance(
          existing,
          (taskId) => cached.find((task) => task.id === taskId),
          new Date(),
        );
        if (next) {
          const placeholder = { ...taskDefaults, ...next, id: optimisticId() } as Task;
          snapshot.push(
            ...(await rewriteCaches<Task[]>(
              queryClient,
              queryKeys.tasksByList(existing.listId),
              (data) => [...data, placeholder].sort(bySortOrder),
            )),
          );
        }
      }
      if (undo) {
        snapshot.push(
          ...(await rewriteCaches<Task[]>(queryClient, queryKeys.tasks, (data) =>
            data.filter((task) => task.recurrenceParentId !== id || task.isCompleted),
          )),
        );
      }
      return { snapshot };
    },
    // Restore in reverse, so the oldest snapshot of each cache is applied last.
    onError: (_error, _input, context) =>
      restoreCaches(queryClient, context?.snapshot.slice().reverse()),
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  });
}

export function useDeleteTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: queryKeys.tasks,
    mutationFn: (id: string) => tasks.delete(id),
    onMutate: async (id) => ({
      snapshot: await rewriteCaches<Task[]>(queryClient, queryKeys.tasks, (data) =>
        data.filter((task) => task.id !== id),
      ),
    }),
    onError: (_error, _id, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => invalidateTasksWhenIdle(queryClient),
  });
}

/** Patches a task in every cached task array, moving it between list caches if its list changed. */
function applyTaskPatch(queryClient: QueryClient, id: string, patch: TaskPatch) {
  const existing = queryClient
    .getQueriesData<Task[]>({ queryKey: queryKeys.tasks })
    .flatMap(([, data]) => data ?? [])
    .find((task) => task.id === id);
  const patched = existing ? { ...existing, ...definedOnly(patch) } : undefined;

  return rewriteCaches<Task[]>(queryClient, queryKeys.tasks, (data, key) => {
    const cacheListId = listIdOfTaskCache(key);
    if (!patched) return data;
    const without = data.filter((task) => task.id !== id);
    const belongs = cacheListId === null || cacheListId === patched.listId;
    const had = without.length !== data.length;
    if (!belongs) return without;
    if (had) return data.map((task) => (task.id === id ? patched : task));
    return cacheListId !== null ? [...data, patched].sort(bySortOrder) : data;
  });
}

// ---- Subtasks ----

export function useSubtasks(taskId: string) {
  const { subtasks } = useRepos();
  return useQuery({
    queryKey: queryKeys.subtasksByTask(taskId),
    queryFn: () => subtasks.getByTask(taskId),
  });
}

export type SubtaskProgress = { done: number; total: number };

/** Done and total subtask counts keyed by task id. A task is absent until loaded, or with none. */
export function useSubtaskProgress(taskIds: readonly string[]): Record<string, SubtaskProgress> {
  const { subtasks } = useRepos();
  return useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: queryKeys.subtasksByTask(taskId),
      queryFn: () => subtasks.getByTask(taskId),
    })),
    combine: (results) => {
      const progress: Record<string, SubtaskProgress> = {};
      results.forEach((result, index) => {
        if (result.data?.length) {
          progress[taskIds[index]] = {
            done: result.data.filter((subtask) => subtask.isDone).length,
            total: result.data.length,
          };
        }
      });
      return progress;
    },
  });
}

/**
 * Options shared by every subtask write. Writes run one at a time so toggles reach the server in
 * order, and the task's subtasks refetch only once the last write has settled.
 */
function subtaskWriteOptions(queryClient: QueryClient) {
  return {
    mutationKey: queryKeys.subtasks,
    scope: { id: "subtask-write" },
    onSettled: (_data: unknown, _error: unknown, input: { taskId: string }) => {
      if (queryClient.isMutating({ mutationKey: queryKeys.subtasks }) > 1) return;
      return queryClient.invalidateQueries({ queryKey: queryKeys.subtasksByTask(input.taskId) });
    },
  };
}

type SubtaskContext = { snapshot: Snapshot<Subtask[]> };

export function useCreateSubtask() {
  const { subtasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    ...subtaskWriteOptions(queryClient),
    mutationFn: (input: NewSubtask) => subtasks.create(input),
    onMutate: async (input) => {
      const placeholder = {
        ...subtaskDefaults,
        ...definedOnly(input),
        id: optimisticId(),
      } as Subtask;
      const snapshot = await rewriteCaches<Subtask[]>(
        queryClient,
        queryKeys.subtasksByTask(input.taskId),
        (data) => [...data, placeholder].sort(bySortOrder),
      );
      return { snapshot, placeholderId: placeholder.id };
    },
    onSuccess: (saved, input, context) => {
      queryClient.setQueryData<Subtask[]>(queryKeys.subtasksByTask(input.taskId), (data) =>
        data?.map((subtask) => (subtask.id === context.placeholderId ? saved : subtask)),
      );
    },
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
  });
}

export type UpdateSubtaskInput = { id: string; taskId: string; patch: SubtaskPatch };

export function useUpdateSubtask() {
  const { subtasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    ...subtaskWriteOptions(queryClient),
    mutationFn: ({ id, patch }: UpdateSubtaskInput) => subtasks.update(id, patch),
    onMutate: async ({ id, taskId, patch }): Promise<SubtaskContext> => ({
      snapshot: await rewriteCaches<Subtask[]>(
        queryClient,
        queryKeys.subtasksByTask(taskId),
        (data) =>
          data
            .map((subtask) => (subtask.id === id ? { ...subtask, ...definedOnly(patch) } : subtask))
            .sort(bySortOrder),
      ),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
  });
}

export type DeleteSubtaskInput = { id: string; taskId: string };

export function useDeleteSubtask() {
  const { subtasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    ...subtaskWriteOptions(queryClient),
    mutationFn: ({ id }: DeleteSubtaskInput) => subtasks.delete(id),
    onMutate: async ({ id, taskId }): Promise<SubtaskContext> => ({
      snapshot: await rewriteCaches<Subtask[]>(
        queryClient,
        queryKeys.subtasksByTask(taskId),
        (data) => data.filter((subtask) => subtask.id !== id),
      ),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
  });
}

export type ReorderSubtasksInput = { taskId: string; changes: SortOrderChange[] };

/** Saves new sort orders for a task's subtasks, showing the new order immediately. */
export function useReorderSubtasks() {
  const { subtasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    ...subtaskWriteOptions(queryClient),
    mutationFn: ({ changes }: ReorderSubtasksInput) =>
      Promise.all(changes.map(({ id, sortOrder }) => subtasks.update(id, { sortOrder }))),
    onMutate: async ({ taskId, changes }): Promise<SubtaskContext> => {
      const sortOrders = new Map(changes.map(({ id, sortOrder }) => [id, sortOrder]));
      return {
        snapshot: await rewriteCaches<Subtask[]>(
          queryClient,
          queryKeys.subtasksByTask(taskId),
          (data) =>
            data
              .map((subtask) =>
                sortOrders.has(subtask.id)
                  ? { ...subtask, sortOrder: sortOrders.get(subtask.id)! }
                  : subtask,
              )
              .sort(bySortOrder),
        ),
      };
    },
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
  });
}

// ---- List mutations ----

export function useCreateList() {
  const { lists } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewList) => lists.create(input),
    onMutate: async (input) => {
      const placeholder = { ...listDefaults, ...definedOnly(input), id: optimisticId() } as List;
      const snapshot = await rewriteCaches<List[]>(queryClient, queryKeys.lists, (data) =>
        [...data, placeholder].sort(bySortOrder),
      );
      return { snapshot, placeholderId: placeholder.id };
    },
    onSuccess: (saved, _input, context) => {
      queryClient.setQueryData<List[]>(queryKeys.lists, (data) =>
        data?.map((list) => (list.id === context.placeholderId ? saved : list)),
      );
    },
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}

export type UpdateListInput = { id: string; patch: ListPatch };

export function useUpdateList() {
  const { lists } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: UpdateListInput) => lists.update(id, patch),
    onMutate: async ({ id, patch }) => ({
      snapshot: await rewriteCaches<List[]>(queryClient, queryKeys.lists, (data) =>
        data
          .map((list) => (list.id === id ? { ...list, ...definedOnly(patch) } : list))
          .sort(bySortOrder),
      ),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}

export type DeleteListInput = { id: string } & DeleteListOptions;

/** Deletes a list, first moving its tasks to `moveTasksTo` unless that is `null`. */
export function useDeleteList() {
  const repos = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, moveTasksTo }: DeleteListInput) => deleteList(repos, id, { moveTasksTo }),
    onMutate: async ({ id }) => ({
      snapshot: await rewriteCaches<List[]>(queryClient, queryKeys.lists, (data) =>
        data.filter((list) => list.id !== id),
      ),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      ]),
  });
}

/** Saves new sort orders for several lists at once, showing the new order immediately. */
export function useReorderLists() {
  const { lists } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (changes: SortOrderChange[]) =>
      Promise.all(changes.map(({ id, sortOrder }) => lists.update(id, { sortOrder }))),
    onMutate: async (changes) => {
      const sortOrders = new Map(changes.map(({ id, sortOrder }) => [id, sortOrder]));
      return {
        snapshot: await rewriteCaches<List[]>(queryClient, queryKeys.lists, (data) =>
          data
            .map((list) =>
              sortOrders.has(list.id) ? { ...list, sortOrder: sortOrders.get(list.id)! } : list,
            )
            .sort(bySortOrder),
        ),
      };
    },
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
  });
}
