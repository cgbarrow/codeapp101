import { expect, test } from "@playwright/test";

test("quick add parses a date, previews it, and shows the row at once", async ({ page }) => {
  await page.goto("/#/list/seed-groceries");
  const field = page.getByRole("textbox", { name: "Add a task" });
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toBeVisible();

  await field.fill("Buy oat milk tomorrow");
  await expect(page.getByRole("button", { name: "Remove date Tomorrow" })).toBeVisible();

  // Time from Enter to the new row appearing, measured inside the page. The mock data layer
  // answers after 250 ms, so a row within 100 ms can only be the optimistic one.
  await page.evaluate(() => {
    const input = document.activeElement ?? document.querySelector("input");
    const w = window as unknown as { rowDelay: Promise<number> };
    w.rowDelay = new Promise((resolve) => {
      input?.addEventListener(
        "keydown",
        (event) => {
          if ((event as KeyboardEvent).key !== "Enter") return;
          const started = performance.now();
          const found = () =>
            document.querySelector('[aria-label="Complete Buy oat milk"]') !== null;
          const observer = new MutationObserver(() => {
            if (!found()) return;
            observer.disconnect();
            resolve(performance.now() - started);
          });
          observer.observe(document.body, { childList: true, subtree: true });
        },
        { capture: true, once: true },
      );
    });
  });
  await field.press("Enter");

  const delay = await page.evaluate(
    () => (window as unknown as { rowDelay: Promise<number> }).rowDelay,
  );
  expect(delay).toBeLessThan(100);

  const row = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox", { name: "Complete Buy oat milk" }) });
  await expect(row).toContainText("Tomorrow");
  await expect(field).toHaveValue("");
  await expect(field).toBeFocused();
});
