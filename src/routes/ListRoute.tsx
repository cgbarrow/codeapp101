import { Link, useParams } from "react-router";
import { TaskList } from "@/components/TaskList/TaskList";
import { useInbox, useLists } from "@/data/queries";
import styles from "./ListRoute.module.css";

/** `/list/:id`: one list and its tasks. */
export function ListRoute() {
  const { id } = useParams();
  const lists = useLists();
  const inbox = useInbox();
  const list = lists.data?.find((candidate) => candidate.id === id);

  if (lists.isPending) return <div className={styles.headingSkeleton} aria-busy="true" />;

  if (!list) {
    return (
      <section className={styles.route}>
        <h1>List not found</h1>
        <p className={styles.note}>It may have been deleted on another device.</p>
        {inbox.data && (
          <Link to={`/list/${inbox.data.id}`} className={styles.link}>
            Go to Inbox
          </Link>
        )}
      </section>
    );
  }

  return (
    <section className={styles.route}>
      <h1>{list.name}</h1>
      {list.isArchived && <p className={styles.note}>Archived</p>}
      <TaskList key={list.id} listId={list.id} listName={list.name} />
    </section>
  );
}
