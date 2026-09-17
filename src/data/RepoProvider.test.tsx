import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createMockRepos } from "./mock/mockRepos";
import { RepoProvider } from "./RepoProvider";
import { useRepos } from "./useRepos";

describe("RepoProvider", () => {
  it("gives components the repositories it was handed", () => {
    const repos = createMockRepos();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <RepoProvider repos={repos}>{children}</RepoProvider>
    );

    const { result } = renderHook(() => useRepos(), { wrapper });

    expect(result.current).toBe(repos);
  });

  it("fails loudly when used outside the provider", () => {
    expect(() => renderHook(() => useRepos())).toThrow("useRepos must be used inside RepoProvider");
  });
});
