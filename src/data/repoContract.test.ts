import { createMockRepos } from "./mock/mockRepos";
import { runRepoContract } from "./repoContract";

runRepoContract("mock", () => createMockRepos());
