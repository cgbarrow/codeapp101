import { useEffect } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { QuickAdd } from "@/components/QuickAdd/QuickAdd";
import { TaskList } from "@/components/TaskList/TaskList";
import { useInbox, useLists } from "@/data/queries";
import type { OpenTaskState } from "@/hooks/useNotifications";
import styles from "./ListRoute.module.css";

/** `/list/:id`: one list and its tasks. */
export function ListRoute() {
  const { id } = useParams();
  const lists = useLists();
  const inbox = useInbox();
  const list = lists.data?.find((candidate) => candidate.id === id);
  const location = useLocation();
  const navigate = useNavigate();
  const openTaskId = (location.state as Partial<OpenTaskState> | null)?.openTaskId;

  // Clear the request once the list has taken it, so a reload does not open the task again.
  useEffect(() => {
    if (openTaskId && list) navigate(location.pathname, { replace: true, state: null });
  }, [openTaskId, list, navigate, location.pathname]);

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
      <QuickAdd key={`add-${list.id}`} listId={list.id} />
      <TaskList
        key={list.id}
        listId={list.id}
        listName={list.name}
        openRequest={openTaskId ? { taskId: openTaskId, key: location.key } : undefined}
      />
    </section>
  );
}
