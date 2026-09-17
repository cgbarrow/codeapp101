import { describe, expect, it, vi } from "vitest";
import { runRepoContract } from "../repoContract";
import { createDataverseRepos } from "./dataverseRepos";
import { createFakeDataverse } from "./fakeDataverse";

runRepoContract("dataverse", () => createDataverseRepos(createFakeDataverse()));

const LIST_ID = "11111111-1111-4111-8111-111111111111";

describe("dataverse repositories", () => {
  it("filters tasks by list with the lookup value and orders by sortOrder", async () => {
    const services = createFakeDataverse();
    const getAll = vi.spyOn(services.tasks, "getAll");
    const repos = createDataverseRepos(services);

    await repos.tasks.getByList(LIST_ID);

    expect(getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: `_cb_list_value eq ${LIST_ID}`,
        orderBy: ["cb_sortorder asc"],
        select: expect.arrayContaining(["cb_todotaskid", "_cb_list_value", "cb_duedate"]),
      }),
    );
  });

  it("asks Dataverse for open tasks due before a moment, earliest first", async () => {
    const services = createFakeDataverse();
    const getAll = vi.spyOn(services.tasks, "getAll");
    const repos = createDataverseRepos(services);

    await repos.tasks.getOpenDueBefore(new Date("2026-09-18T00:00:00.000Z"));

    expect(getAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: "cb_iscompleted eq false and cb_duedate lt 2026-09-18T00:00:00.000Z",
        orderBy: ["cb_duedate asc"],
      }),
    );
  });

  it("sends only the changed columns on update", async () => {
    const services = createFakeDataverse();
    const repos = createDataverseRepos(services);
    const list = await repos.lists.create({ name: "Inbox" });
    const task = await repos.tasks.create({ listId: list.id, title: "Buy milk", notes: "Oat" });
    const update = vi.spyOn(services.tasks, "update");

    await repos.tasks.update(task.id, {
      isCompleted: true,
      completedOn: new Date("2026-09-17T10:00:00Z"),
    });

    expect(update).toHaveBeenCalledWith(task.id, {
      cb_iscompleted: true,
      cb_completedon: "2026-09-17T10:00:00.000Z",
    });
  });

  it("follows skip tokens until every page is read", async () => {
    const services = createFakeDataverse({ pageSize: 2 });
    const repos = createDataverseRepos(services);
    for (const name of ["A", "B", "C", "D", "E"]) {
      await repos.lists.create({ name });
    }

    const lists = await repos.lists.getAll();

    expect(lists).toHaveLength(5);
  });

  it("rejects with the service error when an operation reports failure", async () => {
    const services = createFakeDataverse();
    const failure = new Error("Principal user is missing prvReadcb_todolist privilege");
    vi.spyOn(services.lists, "getAll").mockResolvedValue({
      success: false,
      data: [],
      error: failure,
    });
    const repos = createDataverseRepos(services);

    await expect(repos.lists.getAll()).rejects.toBe(failure);
  });

  it("rejects a failed operation that carries no error object", async () => {
    const services = createFakeDataverse();
    vi.spyOn(services.lists, "getAll").mockResolvedValue({ success: false, data: [] });
    const repos = createDataverseRepos(services);

    await expect(repos.lists.getAll()).rejects.toThrow(/Dataverse/);
  });

  it("never sends a non-GUID id to Dataverse", async () => {
    const services = createFakeDataverse();
    const getAll = vi.spyOn(services.tasks, "getAll");
    const repos = createDataverseRepos(services);

    await expect(repos.tasks.getByList("x or 1 eq 1")).rejects.toThrow(/Not a Dataverse id/);
    expect(getAll).not.toHaveBeenCalled();
  });
});
