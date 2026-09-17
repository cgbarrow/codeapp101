import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./AppShell.module.css";

type AppShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
};

export function AppShell({ sidebar, children }: AppShellProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetId = useId();

  function closeSheet() {
    setSheetOpen(false);
    toggleRef.current?.focus();
  }

  useEffect(() => {
    if (!sheetOpen) return;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSheetOpen(false);
        toggleRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>Simple Todo</span>
        <button
          ref={toggleRef}
          type="button"
          className={styles.control}
          aria-expanded={sheetOpen}
          aria-controls={sheetId}
          onClick={() => (sheetOpen ? closeSheet() : setSheetOpen(true))}
        >
          Lists
        </button>
      </header>

      <div
        className={styles.backdrop}
        data-open={sheetOpen}
        data-testid="sheet-backdrop"
        aria-hidden="true"
        onClick={closeSheet}
      />

      <nav id={sheetId} className={styles.sidebar} aria-label="Lists" data-open={sheetOpen}>
        <div className={styles.sidebarHeader}>
          <span className={styles.wordmark}>Simple Todo</span>
          <button ref={closeRef} type="button" className={styles.control} onClick={closeSheet}>
            Close lists
          </button>
        </div>
        <div className={styles.sidebarBody}>{sidebar}</div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
