import { describe, expect, it } from "vitest";
import { createMockRepos, type MockSyncChannel } from "./mockRepos";
import { createSampleSeed } from "./seed";

/** Channels that deliver to each other asynchronously, as BroadcastChannel does between tabs. */
function createChannels(count: number) {
  const listeners: Array<Array<(event: { data: unknown }) => void>> = [];
  return Array.from({ length: count }, (_, index): MockSyncChannel => {
    listeners[index] = [];
    return {
      postMessage(data) {
        const copy = structuredClone(data);
        listeners.forEach((others, other) => {
          if (other === index) return;
          others.forEach((listener) => setTimeout(() => listener({ data: copy })));
        });
      },
      addEventListener(_type, listener) {
        listeners[index].push(listener);
      },
    };
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 10));
const seed = () => createSampleSeed(new Date(2026, 8, 17, 9, 30));

describe("mock repositories shared between tabs", () => {
  it("shows a write from one tab in another", async () => {
    const [channelA, channelB] = createChannels(2);
    const tabA = createMockRepos({ seed: seed(), sync: channelA });
    const tabB = createMockRepos({ seed: seed(), sync: channelB });
    await settle();

    await tabA.tasks.update("seed-t2", { isCompleted: true });
    const created = await tabA.tasks.create({ listId: "seed-work", title: "From tab A" });
    await settle();

    const inB = await tabB.tasks.getByList("seed-work");
    expect(inB.find((task) => task.id === "seed-t2")?.isCompleted).toBe(true);
    expect(inB.find((task) => task.id === created.id)?.title).toBe("From tab A");
    expect(inB.find((task) => task.id === created.id)?.dueDate).toBeNull();
  });

  it("gives a tab opened later the current data", async () => {
    const [channelA, channelB] = createChannels(2);
    const tabA = createMockRepos({ seed: seed(), sync: channelA });
    await tabA.tasks.delete("seed-t1");

    const tabB = createMockRepos({ seed: seed(), sync: channelB });
    await settle();

    const inbox = await tabB.tasks.getByList("seed-inbox");
    expect(inbox.map((task) => task.id)).not.toContain("seed-t1");
  });

  it("does not hand out the same new id in two tabs", async () => {
    const [channelA, channelB] = createChannels(2);
    const tabA = createMockRepos({ seed: seed(), sync: channelA });
    const tabB = createMockRepos({ seed: seed(), sync: channelB });

    const fromA = await tabA.lists.create({ name: "A" });
    const fromB = await tabB.lists.create({ name: "B" });

    expect(fromA.id).not.toBe(fromB.id);
  });
});
