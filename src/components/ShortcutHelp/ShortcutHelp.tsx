import { useEffect, useId, useRef, useState } from "react";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import styles from "./ShortcutHelp.module.css";

const SHORTCUTS: ReadonlyArray<[key: string, action: string]> = [
  ["n", "New task"],
  ["j", "Next task"],
  ["k", "Previous task"],
  ["x", "Complete or reopen"],
  ["e", "Edit"],
  ["⌫", "Delete"],
  ["1–9", "Switch list"],
  ["?", "Show shortcuts"],
  ["Esc", "Close"],
];

/** A "Keyboard shortcuts" button and the modal it opens; ? toggles it from anywhere. */
export function ShortcutHelp() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  /** Where focus was before the dialog opened; the trigger is hidden on touch devices. */
  const returnFocusTo = useRef<HTMLElement | null>(null);

  useKeyboardShortcuts({ "?": () => (open ? close() : show()) });

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
  }, [open]);

  function show() {
    returnFocusTo.current =
      document.activeElement instanceof HTMLElement && document.activeElement !== document.body
        ? document.activeElement
        : null;
    setOpen(true);
  }

  function close() {
    // Close the modal first: while it is open, everything outside it is inert and cannot take focus.
    dialogRef.current?.close();
    setOpen(false);
    (returnFocusTo.current ?? triggerRef.current)?.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" className={styles.trigger} onClick={show}>
        Keyboard shortcuts
        <kbd className={styles.key} aria-hidden="true">
          ?
        </kbd>
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby={titleId}
          onCancel={(event) => {
            // Escape: keep React in charge of the open state.
            event.preventDefault();
            close();
          }}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            // Handled here so other Escape listeners, such as an open task panel, leave it alone.
            event.preventDefault();
            close();
          }}
        >
          <div className={styles.header}>
            <h2 id={titleId} className={styles.title}>
              Keyboard shortcuts
            </h2>
            <button type="button" className={styles.close} onClick={close}>
              Close
            </button>
          </div>
          <table className={styles.table}>
            <tbody>
              {SHORTCUTS.map(([key, action]) => (
                <tr key={key}>
                  <td className={styles.keyCell}>
                    <kbd className={styles.key}>{key}</kbd>
                  </td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </dialog>
      )}
    </>
  );
}
