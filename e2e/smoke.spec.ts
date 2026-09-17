import { expect, test } from "@playwright/test";

test("app loads and lands on Today", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Today" })).toBeVisible();
  await expect(page).toHaveURL(/#\/today$/);
});
