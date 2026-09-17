import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReminderStatus } from "./ReminderStatus";

function stubNotification(permission: NotificationPermission, answer = permission) {
  const fake = {
    permission,
    requestPermission: vi.fn(async () => {
      fake.permission = answer;
      return answer;
    }),
  };
  vi.stubGlobal("Notification", fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReminderStatus", () => {
  it("offers to turn reminders on when the user has not decided, and asks on click", async () => {
    const user = userEvent.setup();
    const fake = stubNotification("default", "granted");
    render(<ReminderStatus />);

    expect(screen.getByText("Reminders are off.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Turn on reminders" }));

    expect(fake.requestPermission).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Reminders are on while this tab is open.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on reminders" })).not.toBeInTheDocument();
  });

  it("explains how to allow notifications when they are blocked", () => {
    stubNotification("denied");
    render(<ReminderStatus />);

    expect(
      screen.getByText(
        "Reminders are blocked. Allow notifications for this site in your browser settings.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("says so when the browser cannot show notifications", () => {
    vi.stubGlobal("Notification", undefined);
    render(<ReminderStatus />);

    expect(screen.getByText("This browser can't show reminders.")).toBeInTheDocument();
  });

  it("is a labelled group", () => {
    stubNotification("granted");
    render(<ReminderStatus />);

    expect(screen.getByRole("group", { name: "Reminders" })).toHaveTextContent(
      "Reminders are on while this tab is open.",
    );
  });
});
