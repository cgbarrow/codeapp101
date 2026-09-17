import { expect, test } from "@playwright/test";

test("completing a weekly task creates the next instance a week later, and Undo removes it", async ({
  page,
}) => {
  await page.goto("/#/list/seed-personal");
  const openTasks = page.getByRole("list", { name: "Open tasks" });
  const waterings = openTasks.getByRole("listitem").filter({
    has: page.getByRole("button", { name: "Water the plants" }),
  });
  await expect(waterings).toHaveCount(1);
  await expect(waterings.locator("[data-due]")).toHaveText("Today");

  // The label TaskRow shows for a date more than a day away, formatted by the browser.
  const nextWeek = await page.evaluate(() => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
    };
    if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
    return new Intl.DateTimeFormat(undefined, options).format(date).replace(",", "");
  });

  await page.getByRole("checkbox", { name: "Complete Water the plants" }).click();

  await expect(waterings).toHaveCount(1);
  await expect(waterings.locator("[data-due]")).toHaveText(nextWeek);
  await expect(waterings.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(waterings).toHaveCount(1);
  await expect(waterings.locator("[data-due]")).toHaveText("Today");
});
