import { expect, test, type Page } from "@playwright/test";

/** The list sidebar is a bottom sheet under 768px; open it before using it. */
async function openLists(page: Page) {
  const toggle = page.getByRole("button", { name: "Lists", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  return page.getByRole("navigation", { name: "Lists" });
}

test("capture to done: new list, quick add with a date, complete, undo, delete", async ({
  page,
}) => {
  await page.goto("/");

  const nav = await openLists(page);
  await nav.getByRole("button", { name: "New list" }).click();
  await nav.getByRole("textbox", { name: "List name" }).fill("Shopping");
  await nav.getByRole("textbox", { name: "List name" }).press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: "Shopping" })).toBeVisible();

  const input = page.getByRole("textbox", { name: "Add a task" });
  await input.fill("Buy milk on Friday");
  // "Friday" is shown as a weekday, or as "Tomorrow" when the test runs on a Thursday.
  const chip = page.getByRole("button", { name: /^Remove date/ });
  await expect(chip).toHaveText(/Fri|Tomorrow/);
  const dueLabel = (await chip.textContent())!.trim();
  await input.press("Enter");

  const row = page.getByRole("listitem").filter({ hasText: "Buy milk" });
  await expect(row.locator("[data-title]")).toHaveText("Buy milk");
  await expect(row.locator("[data-due]")).toHaveText(dueLabel);
  await expect(input).toHaveValue("");

  const checkbox = page.getByRole("checkbox", { name: "Complete Buy milk" });
  await checkbox.click();
  await expect(checkbox).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.getByRole("button", { name: /^Completed \(/ })).toBeHidden();

  await page.getByRole("button", { name: "Buy milk" }).click();
  await page.getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByText("Deleted Buy milk")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toBeHidden();

  // Undo restores the task, so nothing is lost by a mistaken delete.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toBeVisible();
});

test("a list keeps its tasks when it is deleted, if they move to the Inbox", async ({ page }) => {
  await page.goto("/#/list/seed-groceries");
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toBeVisible();

  const nav = await openLists(page);
  await nav.getByRole("button", { name: "Edit lists" }).click();
  await nav.getByRole("button", { name: "Delete Groceries" }).click();
  await page.getByRole("button", { name: "Move to Inbox" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Complete Buy milk" })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Groceries/ })).toBeHidden();
});
