import { expect, test } from "@playwright/test";

test("task detail edits the due date and shows it on the row", async ({ page }) => {
  await page.goto("/#/list/seed-personal");
  const title = page.getByRole("button", { name: "Pack for the weekend" });
  await title.click();

  const panel = page.getByRole("region", { name: "Task details" });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Title")).toBeFocused();

  // Below 768px the panel is a full-width bottom sheet.
  const viewport = page.viewportSize()!;
  if (viewport.width < 768) {
    const box = (await panel.boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.width).toBe(viewport.width);
    await expect(async () => {
      const settled = (await panel.boundingBox())!;
      expect(Math.round(settled.y + settled.height)).toBe(viewport.height);
    }).toPass();
  }

  const date = panel.getByLabel("Due date");
  const box = (await date.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);

  const nextYear = new Date().getFullYear() + 1;
  await date.fill(`${nextYear}-01-05`);
  await date.blur();

  const row = page.getByRole("listitem").filter({ has: title });
  await expect(row.locator("[data-due]")).toContainText(String(nextYear));

  await panel.getByLabel("Time").fill("15:30");
  await panel.getByLabel("Time").blur();
  await expect(row.locator("[data-due]")).toContainText(/3:30|15:30/);

  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
});
