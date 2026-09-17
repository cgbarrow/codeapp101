import { expect, test } from "@playwright/test";

const widths = [320, 375, 414, 768, 1024, 1440];
const saveScreenshots = !!process.env.SHELL_SCREENSHOTS;

for (const width of widths) {
  test(`shell has no horizontal scroll at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    if (saveScreenshots && testInfo.project.name === "desktop-chromium") {
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `docs/design/shell-${width}.png` });
    }
  });
}

test("below 768px the list sidebar is a bottom sheet behind a toggle", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const lists = page.getByRole("navigation", { name: "Lists" });
  const toggle = page.getByRole("button", { name: "Lists", exact: true });

  await expect(lists).toBeHidden();
  await toggle.click();
  await expect(lists).toBeVisible();
  if (saveScreenshots && test.info().project.name === "desktop-chromium") {
    await page.waitForTimeout(500);
    await page.screenshot({ path: "docs/design/shell-375-sheet-open.png" });
  }
  await page.keyboard.press("Escape");
  await expect(lists).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("from 768px the list sidebar is always visible and the toggle is gone", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Lists" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lists", exact: true })).toBeHidden();
});
