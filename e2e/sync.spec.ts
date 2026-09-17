import { expect, test } from "@playwright/test";

// Mock mode shares data between tabs over a BroadcastChannel, standing in for Dataverse.
test("a change in one tab shows in another when it regains focus", async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  await first.goto("/#/list/seed-work");
  await second.goto("/#/list/seed-work");
  const task = "Send the Q3 budget draft";
  await expect(second.getByRole("checkbox", { name: `Complete ${task}` })).toBeVisible();

  await first.getByRole("checkbox", { name: `Complete ${task}` }).click();
  await expect(first.getByRole("button", { name: "Completed (2)" })).toBeVisible();

  // Both pages stay "visible" in a headless browser, so signal the focus change directly.
  await second.evaluate(() => window.dispatchEvent(new Event("focus")));

  await expect(second.getByRole("checkbox", { name: `Complete ${task}` })).toBeHidden();
  await expect(second.getByRole("button", { name: "Completed (2)" })).toBeVisible();
});
