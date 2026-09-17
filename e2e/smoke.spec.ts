import { expect, test } from "@playwright/test";

test("app loads and shows its name", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Simple Todo" })).toBeVisible();
});
