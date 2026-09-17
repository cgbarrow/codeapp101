import { createMockRepos } from "./mock/mockRepos";
import { createSampleSeed } from "./mock/seed";
import type { Repos } from "./repo";

type RepoEnv = {
  VITE_USE_MOCKS?: string;
};

/** Picks the repository implementation for this build from the Vite environment. */
export function createRepos(env: RepoEnv, now = new Date()): Repos {
  if (env.VITE_USE_MOCKS === "true") {
    return createMockRepos({ seed: createSampleSeed(now), latencyMs: 250 });
  }
  throw new Error(
    "The Dataverse repositories arrive in task 4. Set VITE_USE_MOCKS=true (npm run dev does) to use sample data.",
  );
}
