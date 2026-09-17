export type Recurrence = "none" | "daily" | "weekly" | "monthly";

export type List = {
  id: string;
  name: string;
  sortOrder: number;
  isInbox: boolean;
  isArchived: boolean;
};

export type Task = {
  id: string;
  listId: string;
  title: string;
  notes: string;
  dueDate: Date | null;
  hasTime: boolean;
  reminderAt: Date | null;
  isCompleted: boolean;
  completedOn: Date | null;
  recurrence: Recurrence;
  recurrenceParentId: string | null;
  sortOrder: number;
};

export type Subtask = {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  sortOrder: number;
};

export type NewList = Pick<List, "name"> & Partial<Omit<List, "id" | "name">>;
export type ListPatch = Partial<Omit<List, "id">>;

export type NewTask = Pick<Task, "listId" | "title"> &
  Partial<Omit<Task, "id" | "listId" | "title">>;
export type TaskPatch = Partial<Omit<Task, "id">>;

export type NewSubtask = Pick<Subtask, "taskId" | "title"> &
  Partial<Omit<Subtask, "id" | "taskId" | "title">>;
export type SubtaskPatch = Partial<Omit<Subtask, "id" | "taskId">>;

export interface ListRepo {
  /** All lists, including archived ones, ordered by sortOrder. */
  getAll(): Promise<List[]>;
  create(input: NewList): Promise<List>;
  /** Applies only the fields present in the patch. Rejects if the list does not exist. */
  update(id: string, patch: ListPatch): Promise<List>;
  /** Deletes the list and, as Dataverse does, every task in it. */
  delete(id: string): Promise<void>;
}

export interface TaskRepo {
  /** Tasks in one list, completed or not, ordered by sortOrder. */
  getByList(listId: string): Promise<Task[]>;
  /** Incomplete tasks in any list whose due date is before `end`, earliest first. */
  getOpenDueBefore(end: Date): Promise<Task[]>;
  create(input: NewTask): Promise<Task>;
  update(id: string, patch: TaskPatch): Promise<Task>;
  /** Deletes the task and its subtasks. */
  delete(id: string): Promise<void>;
}

export interface SubtaskRepo {
  /** Subtasks of one task, ordered by sortOrder. */
  getByTask(taskId: string): Promise<Subtask[]>;
  create(input: NewSubtask): Promise<Subtask>;
  update(id: string, patch: SubtaskPatch): Promise<Subtask>;
  delete(id: string): Promise<void>;
}

export type Repos = {
  lists: ListRepo;
  tasks: TaskRepo;
  subtasks: SubtaskRepo;
};
