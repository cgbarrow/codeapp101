import { expect, test } from "@playwright/test";

test("Today groups due work, files quick adds into the Inbox, and is remembered", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Overdue in Work" })).toContainText(
    "Send the Q3 budget draft",
  );
  await expect(page.getByRole("list", { name: "Today in Personal" })).toContainText(
    "Water the plants",
  );

  const input = page.getByRole("textbox", { name: "Add a task" });
  await input.fill("Book the dentist today");
  await input.press("Enter");
  await expect(page.getByRole("list", { name: "Today in Inbox" })).toContainText(
    "Book the dentist",
  );
  await expect(page.getByText("Added Book the dentist to Inbox.")).toBeVisible();

  await input.press("Escape");
  await page.keyboard.press("2");
  await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();

  await page.keyboard.press("t");
  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(page).toHaveURL(/#\/today$/);
});
