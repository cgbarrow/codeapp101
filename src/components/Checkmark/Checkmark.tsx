import { useEffect, useState } from "react";
import styles from "./Checkmark.module.css";

/** Length of the completion animation, matched in Checkmark.module.css. */
export const COMPLETION_MS = 200;

type CheckmarkProps = {
  checked: boolean;
  /** Accessible name, such as "Complete Buy milk". */
  label: string;
  onChange: () => void;
  disabled?: boolean;
  /** A pending save shows as loading; a failed one as error. */
  state?: "loading" | "error";
};

/** The round completion checkbox: a 44px target around a 22px circle. */
export function Checkmark({ checked, label, onChange, disabled = false, state }: CheckmarkProps) {
  const [animating, setAnimating] = useState(false);

  // A timer rather than animationend: with reduced motion or no CSS the event never fires.
  useEffect(() => {
    if (!animating) return;
    const timer = setTimeout(() => setAnimating(false), COMPLETION_MS);
    return () => clearTimeout(timer);
  }, [animating]);

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      aria-busy={state === "loading" || undefined}
      className={styles.checkmark}
      data-state={state}
      data-animating={animating || undefined}
      disabled={disabled}
      onClick={() => {
        setAnimating(!checked);
        onChange();
      }}
    >
      <span className={styles.circle} aria-hidden="true">
        <svg className={styles.tick} viewBox="0 0 24 24" focusable="false">
          <path d="M6.5 12.5l3.5 3.5 7.5-8" pathLength="1" />
        </svg>
      </span>
    </button>
  );
}
