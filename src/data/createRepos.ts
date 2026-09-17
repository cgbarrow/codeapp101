import { createDataverseRepos } from "./dataverse/dataverseRepos";
import { generatedServices } from "./dataverse/generatedServices";
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
  return createDataverseRepos(generatedServices);
}
