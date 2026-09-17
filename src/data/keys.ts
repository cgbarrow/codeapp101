export const queryKeys = {
  lists: ["lists"] as const,
  tasks: ["tasks"] as const,
  tasksByList: (listId: string) => ["tasks", "list", listId] as const,
  tasksDueBefore: (end: Date) => ["tasks", "dueBefore", end.toISOString()] as const,
};
