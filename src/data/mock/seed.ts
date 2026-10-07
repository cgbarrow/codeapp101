import { taskDefaults } from "../defaults";
import type { List, Subtask, Task } from "../repo";
import type { MockSeed } from "./mockRepos";

function atDay(now: Date, dayOffset: number, hours = 0, minutes = 0) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes);
}

function task(fields: Pick<Task, "id" | "listId" | "title" | "sortOrder"> & Partial<Task>): Task {
  return { ...taskDefaults, ...fields };
}

/** Sample data for `npm run dev`, with dates relative to `now` so Today always has content. */
export function createSampleSeed(now: Date): MockSeed {
  const lists: List[] = [
    { id: "seed-inbox", name: "Inbox", sortOrder: 0, isInbox: true, isArchived: false },
    { id: "seed-work", name: "Work", sortOrder: 1, isInbox: false, isArchived: false },
    { id: "seed-personal", name: "Personal", sortOrder: 2, isInbox: false, isArchived: false },
    { id: "seed-groceries", name: "Groceries", sortOrder: 3, isInbox: false, isArchived: false },
  ];

  const tasks: Task[] = [
    task({ id: "seed-t1", listId: "seed-inbox", title: "Reply to the landlord", sortOrder: 0 }),
    task({
      id: "seed-t2",
      listId: "seed-work",
      title: "Send the Q3 budget draft",
      sortOrder: 0,
      dueDate: atDay(now, -2),
    }),
    task({
      id: "seed-t3",
      listId: "seed-work",
      title: "Call Sam about the offsite",
      sortOrder: 1,
      dueDate: atDay(now, 0, 15),
      hasTime: true,
      reminderAt: atDay(now, 0, 14, 50),
    }),
    task({
      id: "seed-t4",
      listId: "seed-work",
      title: "Review the pull request",
      sortOrder: 2,
      isCompleted: true,
      completedOn: atDay(now, -1, 16),
    }),
    task({
      id: "seed-t5",
      listId: "seed-personal",
      title: "Water the plants",
      sortOrder: 0,
      dueDate: atDay(now, 0),
      recurrence: "weekly",
    }),
    task({
      id: "seed-t6",
      listId: "seed-personal",
      title: "Pack for the weekend",
      notes: "Train leaves at 18:10.",
      sortOrder: 1,
      dueDate: atDay(now, 2),
      reminderAt: atDay(now, 2, 9, 0),
      reminderEmailSentAt: atDay(now, 2, 9, 1),
    }),
    task({
      id: "seed-t7",
      listId: "seed-groceries",
      title: "Buy milk",
      sortOrder: 0,
      dueDate: atDay(now, 1),
    }),
  ];

  const subtasks: Subtask[] = [
    { id: "seed-s1", taskId: "seed-t6", title: "Charger", isDone: true, sortOrder: 0 },
    { id: "seed-s2", taskId: "seed-t6", title: "Walking boots", isDone: false, sortOrder: 1 },
    { id: "seed-s3", taskId: "seed-t6", title: "Tickets", isDone: false, sortOrder: 2 },
  ];

  return { lists, tasks, subtasks };
}
