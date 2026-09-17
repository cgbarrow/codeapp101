import styles from "./Skeleton.module.css";

type SkeletonRowsProps = {
  count: number;
  /** `row` matches a task row; `compact` matches a single-line item such as a subtask. */
  size?: "row" | "compact";
};

/**
 * Placeholder list items shown while data loads, so the page never sits blank. Put them inside the
 * list that will hold the data and mark that list `aria-busy`; the placeholders are hidden from
 * assistive technology.
 */
export function SkeletonRows({ count, size = "row" }: SkeletonRowsProps) {
  return Array.from({ length: count }, (_, index) => (
    <li key={index} className={styles.skeleton} data-size={size} data-skeleton aria-hidden="true" />
  ));
}
