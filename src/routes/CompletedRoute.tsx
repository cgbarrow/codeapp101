import { TaskRow } from "@/components/TaskRow/TaskRow";
import { useCompletedTasks, useLists } from "@/data/queries";
import { useTaskToggle } from "@/hooks/useTaskToggle";
import styles from "./ListRoute.module.css";

/** `/completed`: every completed task across all lists, most recent first. */
export function CompletedRoute() {
  const lists = useLists();
  const all = lists.data ?? [];
  const completed = useCompletedTasks(all.map((list) => list.id));
  const { toggle } = useTaskToggle();
  const names = new Map(all.map((list) => [list.id, list.name]));
  const now = new Date();
  const failed = lists.isError || completed.isError;
  const pending = lists.isPending || completed.isPending;

  return (
    <section className={styles.route}>
      <h1>Completed</h1>
      {failed && (
        <div role="alert" className={styles.alert}>
          <p>Completed tasks didn't load.</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => (lists.isError ? lists.refetch() : completed.refetch())}
          >
            Try again
          </button>
        </div>
      )}
      <ul className={styles.rows} aria-label="Completed tasks" aria-busy={pending}>
        {completed.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            now={now}
            onToggle={toggle}
            listName={names.get(task.listId)}
          />
        ))}
      </ul>
      {!pending && !failed && completed.tasks.length === 0 && (
        <p className={styles.note}>No completed tasks.</p>
      )}
    </section>
  );
}
