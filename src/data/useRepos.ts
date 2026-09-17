import { createContext, useContext } from "react";
import type { Repos } from "./repo";

export const RepoContext = createContext<Repos | null>(null);

export function useRepos(): Repos {
  const repos = useContext(RepoContext);
  if (!repos) throw new Error("useRepos must be used inside RepoProvider");
  return repos;
}
