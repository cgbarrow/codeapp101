import { useState } from "react";
import type { List, Task } from "@/data/repo";
import { useRepos } from "@/data/useRepos";
import styles from "./DataverseSmoke.module.css";

type Step = {
  label: string;
  enabled: boolean;
  run: () => Promise<string>;
};

/**
 * Development-only check that the repositories can write to the real environment. Opened with
 * `?smoke=dataverse` on a dev server; every record it creates it also deletes.
 */
export function DataverseSmoke() {
  const repos = useRepos();
  const [list, setList] = useState<List | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const steps: Step[] = [
    {
      label: "Create list",
      enabled: list === null,
      run: async () => {
        const created = await repos.lists.create({
          name: `Smoke test ${new Date().toISOString()}`,
        });
        setList(created);
        return `Created list "${created.name}" (${created.id})`;
      },
    },
    {
      label: "Create task",
      enabled: list !== null && task === null,
      run: async () => {
        const created = await repos.tasks.create({ listId: list!.id, title: "Smoke test task" });
        setTask(created);
        return `Created task ${created.id} in list ${created.listId}`;
      },
    },
    {
      label: "Mark task complete",
      enabled: task !== null && !task.isCompleted,
      run: async () => {
        const updated = await repos.tasks.update(task!.id, {
          isCompleted: true,
          completedOn: new Date(),
        });
        setTask(updated);
        return `Marked task complete at ${updated.completedOn?.toISOString()}`;
      },
    },
    {
      label: "Delete task",
      enabled: task !== null,
      run: async () => {
        await repos.tasks.delete(task!.id);
        setTask(null);
        return "Deleted task";
      },
    },
    {
      label: "Delete list",
      enabled: list !== null && task === null,
      run: async () => {
        await repos.lists.delete(list!.id);
        setList(null);
        return "Deleted list";
      },
    },
  ];

  async function runStep(step: Step) {
    setBusy(true);
    setError(null);
    try {
      const message = await step.run();
      setLog((entries) => [...entries, message]);
    } catch (caught) {
      setError(
        `${step.label} failed: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.smoke} aria-busy={busy}>
      <h1>Dataverse smoke test</h1>
      <p>Run each step, then check the record in the maker portal before the next one.</p>
      <div className={styles.steps}>
        {steps.map((step) => (
          <button
            key={step.label}
            type="button"
            className={styles.step}
            disabled={!step.enabled || busy}
            onClick={() => void runStep(step)}
          >
            {step.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <ol className={styles.log}>
        {log.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ol>
    </section>
  );
}
