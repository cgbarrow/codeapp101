import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import { App } from "@/App";
import { createRepos } from "@/data/createRepos";
import { RepoProvider } from "@/data/RepoProvider";

const queryClient = new QueryClient();
const repos = createRepos(import.meta.env);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepoProvider repos={repos}>
        <App />
      </RepoProvider>
    </QueryClientProvider>
  </StrictMode>,
);
