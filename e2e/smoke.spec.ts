import { expect, test } from "@playwright/test";

test("app loads and lands on the Inbox", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Inbox" })).toBeVisible();
  await expect(page).toHaveURL(/#\/list\//);
});
