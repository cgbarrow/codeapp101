export const queryKeys = {
  lists: ["lists"] as const,
  inbox: ["inbox"] as const,
  tasks: ["tasks"] as const,
  tasksByList: (listId: string) => ["tasks", "list", listId] as const,
  tasksDueBefore: (end: Date) => ["tasks", "dueBefore", end.toISOString()] as const,
  subtasks: ["subtasks"] as const,
  subtasksByTask: (taskId: string) => ["subtasks", "task", taskId] as const,
};
