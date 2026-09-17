import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { definedOnly, listDefaults, taskDefaults } from "./defaults";
import { queryKeys } from "./keys";
import type { List, ListPatch, NewList, NewTask, Task, TaskPatch } from "./repo";
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

function listIdOfTaskCache(key: QueryKey): string | null {
  return key[1] === "list" ? (key[2] as string) : null;
}

// ---- Queries ----

export function useLists() {
  const { lists } = useRepos();
  return useQuery({ queryKey: queryKeys.lists, queryFn: () => lists.getAll() });
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

export function useCreateTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewTask) => tasks.create(input),
    onMutate: async (input) => {
      const placeholder = {
        ...taskDefaults,
        ...definedOnly(input),
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
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

export type UpdateTaskInput = { id: string; patch: TaskPatch };

export function useUpdateTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, patch }: UpdateTaskInput) => tasks.update(id, patch),
    onMutate: async ({ id, patch }) => ({
      snapshot: await applyTaskPatch(queryClient, id, patch),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

export type ToggleTaskInput = { id: string; isCompleted: boolean };

export function useToggleTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();
  const patchFor = (isCompleted: boolean): TaskPatch => ({
    isCompleted,
    completedOn: isCompleted ? new Date() : null,
  });

  return useMutation({
    mutationFn: ({ id, isCompleted }: ToggleTaskInput) => tasks.update(id, patchFor(isCompleted)),
    onMutate: async ({ id, isCompleted }) => ({
      snapshot: await applyTaskPatch(queryClient, id, patchFor(isCompleted)),
    }),
    onError: (_error, _input, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
  });
}

export function useDeleteTask() {
  const { tasks } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tasks.delete(id),
    onMutate: async (id) => ({
      snapshot: await rewriteCaches<Task[]>(queryClient, queryKeys.tasks, (data) =>
        data.filter((task) => task.id !== id),
      ),
    }),
    onError: (_error, _id, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
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

export function useDeleteList() {
  const { lists } = useRepos();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => lists.delete(id),
    onMutate: async (id) => ({
      snapshot: await rewriteCaches<List[]>(queryClient, queryKeys.lists, (data) =>
        data.filter((list) => list.id !== id),
      ),
    }),
    onError: (_error, _id, context) => restoreCaches(queryClient, context?.snapshot),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.lists }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tasks }),
      ]),
  });
}
