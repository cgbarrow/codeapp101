import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 800 } });

test("keyboard: select, complete, delete and the shortcut list", async ({ page }) => {
  await page.goto("/#/list/seed-work");
  const draft = page.getByRole("button", { name: "Send the Q3 budget draft" });
  const call = page.getByRole("button", { name: "Call Sam about the offsite" });
  await expect(call).toBeVisible();

  await page.keyboard.press("j");
  await expect(draft).toBeFocused();
  await page.keyboard.press("j");
  await expect(call).toBeFocused();
  await page.keyboard.press("k");
  await expect(draft).toBeFocused();

  await page.keyboard.press("x");
  await expect(
    page.getByRole("checkbox", { name: "Complete Send the Q3 budget draft" }),
  ).toHaveAttribute("aria-checked", "true");

  await call.focus();
  await page.keyboard.press("Backspace");
  await expect(call).toBeHidden();
  await expect(page.getByText("Deleted Call Sam about the offsite")).toBeVisible();

  // Native <dialog>: focus moves inside on open, Escape closes, focus goes back where it was.
  const heading = page.getByRole("heading", { level: 1, name: "Work" });
  await heading.evaluate((element) => {
    element.tabIndex = -1;
    element.focus();
  });
  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(heading).toBeFocused();
});
