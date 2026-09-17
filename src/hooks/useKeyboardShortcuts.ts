import { useEffect, useRef } from "react";

/** Return `false` to leave the key unhandled, so its default action still happens. */
export type ShortcutHandler = (event: KeyboardEvent) => void | false;

export function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ) !== null)
  );
}

/**
 * Single-key shortcuts on the document, keyed by `KeyboardEvent.key`. They are inert while the user
 * types in a field or holds Ctrl, Cmd or Alt, so they never steal a character or a browser shortcut.
 */
export function useKeyboardShortcuts(handlers: Partial<Record<string, ShortcutHandler>>) {
  const latest = useRef(handlers);

  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const handler = latest.current[event.key];
      if (handler && handler(event) !== false) event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
