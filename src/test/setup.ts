import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// Node takes its default locale from the OS, and ignores LANG on Windows, so the same assertion
// reads "3:00 PM" on a machine set to en-US and "3:00 p.m." on one set to en-CA. Pin it, as
// vitest.config.ts pins the timezone. Callers that pass a locale still get the one they asked for.
type FormatArgs = [Intl.LocalesArgument?, Intl.DateTimeFormatOptions?];
Intl.DateTimeFormat = new Proxy(Intl.DateTimeFormat, {
  construct: (target, [locales, options]: FormatArgs) => new target(locales ?? "en-US", options),
  apply: (target, _thisArg, [locales, options]: FormatArgs) =>
    new target(locales ?? "en-US", options),
});

// jsdom has no modal dialog support. Like browsers, move focus to the first focusable element;
// browsers also trap focus and make the page inert, which tests do not need.
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button, [href], input, select, textarea, [tabindex]")?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
