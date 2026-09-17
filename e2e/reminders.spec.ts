import { expect, test } from "@playwright/test";

/**
 * Real notifications need an OS permission prompt, so the page gets a stand-in `Notification` that
 * records what the app shows. Playwright's clock moves time on to the reminder.
 */
test("a due reminder shows a notification, and clicking it opens the task", async ({ page }) => {
  await page.addInitScript(() => {
    const shown: Array<{ title: string; body?: string; click: () => void }> = [];
    class RecordingNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(title: string, options: NotificationOptions = {}) {
        shown.push({ title, body: options.body, click: () => this.onclick?.() });
      }
      close() {}
    }
    Object.assign(window, { Notification: RecordingNotification, shownNotifications: shown });
  });

  // The sample data puts "Call Sam about the offsite" due today at 15:00, reminding at 14:50.
  const now = new Date();
  await page.clock.install({
    time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 49, 40),
  });
  await page.goto("/#/list/seed-inbox");
  // In the sidebar, which is a closed sheet on a phone.
  await expect(page.getByText("Reminders are on while this tab is open.")).toBeAttached();

  const shownTitles = () =>
    page.evaluate(() =>
      (
        window as unknown as { shownNotifications: Array<{ title: string }> }
      ).shownNotifications.map((n) => n.title),
    );
  expect(await shownTitles()).toEqual([]);

  await page.clock.runFor(60_000);
  await expect.poll(shownTitles).toEqual(["Call Sam about the offsite"]);

  await page.clock.runFor(120_000);
  expect(await shownTitles()).toEqual(["Call Sam about the offsite"]);

  await page.evaluate(() =>
    (
      window as unknown as { shownNotifications: Array<{ click: () => void }> }
    ).shownNotifications[0].click(),
  );
  await expect(page.getByRole("heading", { level: 1, name: "Work" })).toBeVisible();
  const panel = page.getByRole("region", { name: "Task details" });
  await expect(panel).toBeVisible();
  await expect(panel.getByLabel("Title")).toHaveValue("Call Sam about the offsite");
});
