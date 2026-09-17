import type { ReactNode } from "react";
import type { Repos } from "./repo";
import { RepoContext } from "./useRepos";

type RepoProviderProps = {
  repos: Repos;
  children: ReactNode;
};

export function RepoProvider({ repos, children }: RepoProviderProps) {
  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}
