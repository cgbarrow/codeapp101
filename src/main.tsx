import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import "@/styles/fonts.css";
import "@/styles/tokens.css";
import "@/styles/base.css";
import { App } from "@/App";
import { ToastProvider } from "@/components/Toast/ToastProvider";
import { createRepos } from "@/data/createRepos";
import { RepoProvider } from "@/data/RepoProvider";

const queryClient = new QueryClient();
const repos = createRepos(import.meta.env);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RepoProvider repos={repos}>
        {/* Hash URLs: the Power Apps host serves index.html from a fixed URL with no rewrites. */}
        <HashRouter>
          <ToastProvider>
            <App />
          </ToastProvider>
        </HashRouter>
      </RepoProvider>
    </QueryClientProvider>
  </StrictMode>,
);
