import { QuickAdd } from "@/components/QuickAdd/QuickAdd";
import { SkeletonRows } from "@/components/Skeleton/SkeletonRows";
import { useTaskRows } from "@/components/TaskList/useTaskRows";
import { useInbox, useLists, useTasksInLists } from "@/data/queries";
import { selectToday } from "@/features/today/selectToday";
import { useTaskToggle } from "@/hooks/useTaskToggle";
import styles from "./TodayRoute.module.css";

type TodayRouteProps = { now?: Date };

/** `/today`: overdue and due-today tasks from every active list. Quick add files into the Inbox. */
export function TodayRoute({ now = new Date() }: TodayRouteProps) {
  const lists = useLists();
  const inbox = useInbox();
  const active = (lists.data ?? []).filter((list) => !list.isArchived);
  const tasks = useTasksInLists(active.map((list) => list.id));
  const { toggle, lingering } = useTaskToggle();

  // A just-completed task stays in place until its tick animation has played.
  const byId = new Map(tasks.tasks.map((task) => [task.id, task]));
  const sections = selectToday(
    tasks.tasks.map((task) => (lingering.has(task.id) ? { ...task, isCompleted: false } : task)),
    active,
    now,
  ).map((section) => ({
    ...section,
    groups: section.groups.map((group) => ({
      ...group,
      tasks: group.tasks.map((task) => byId.get(task.id)!),
    })),
  }));
  const visible = sections.flatMap((section) => section.groups.flatMap((group) => group.tasks));
  const { containerRef, row } = useTaskRows({ visible, now, onToggle: toggle });

  const failed = lists.isError || tasks.isError;
  const pending = !failed && (lists.isPending || tasks.isPending);

  return (
    <section className={styles.route}>
      <h1>Today</h1>
      {inbox.data && <QuickAdd listId={inbox.data.id} listName={inbox.data.name} now={now} />}

      {failed && (
        <div role="alert" className={styles.alert}>
          <p>Today's tasks didn't load.</p>
          <button
            type="button"
            className={styles.button}
            onClick={() => (lists.isError ? lists.refetch() : tasks.refetch())}
          >
            Try again
          </button>
        </div>
      )}

      {pending && (
        <ul className={styles.rows} aria-label="Today's tasks" aria-busy="true">
          <SkeletonRows count={3} />
        </ul>
      )}

      {!pending && !failed && sections.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing due today.</p>
          <p className={styles.note}>Add a task above, or press n.</p>
        </div>
      )}

      <div ref={containerRef} className={styles.sections}>
        {sections.map((section) => (
          <section key={section.title} className={styles.section}>
            <h2
              className={styles.sectionHeading}
              data-tone={section.title === "Overdue" ? "overdue" : undefined}
            >
              {section.title}
            </h2>
            {section.groups.map((group) => {
              const label = `${section.title} in ${group.list.name}`;
              return (
                <div key={group.list.id} className={styles.group}>
                  <h3 className={styles.groupHeading}>{group.list.name}</h3>
                  <ul className={styles.rows} aria-label={label}>
                    {group.tasks.map((task) =>
                      row(task, lingering.has(task.id) ? "success" : undefined),
                    )}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
}
