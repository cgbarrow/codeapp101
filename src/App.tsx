import { lazy, Suspense } from "react";
import { AppShell } from "@/components/AppShell/AppShell";

const DataverseSmoke = lazy(() =>
  import("@/components/DataverseSmoke/DataverseSmoke").then((module) => ({
    default: module.DataverseSmoke,
  })),
);

const smokeEnabled = import.meta.env.DEV && import.meta.env.VITE_DATAVERSE_SMOKE === "true";

type AppProps = {
  /** Show the development-only Dataverse smoke test in the main pane. */
  smoke?: boolean;
};

export function App({ smoke = smokeEnabled }: AppProps) {
  return (
    <AppShell sidebar={null}>
      {smoke ? (
        <Suspense fallback={null}>
          <DataverseSmoke />
        </Suspense>
      ) : (
        <h1>Simple Todo</h1>
      )}
    </AppShell>
  );
}
