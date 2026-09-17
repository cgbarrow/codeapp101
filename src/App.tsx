import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { AppShell } from "@/components/AppShell/AppShell";
import { ListNav } from "@/components/ListNav/ListNav";
import { ShortcutHelp } from "@/components/ShortcutHelp/ShortcutHelp";
import { useInbox } from "@/data/queries";
import { CompletedRoute } from "@/routes/CompletedRoute";
import { ListRoute } from "@/routes/ListRoute";

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
    <AppShell
      sidebar={
        <>
          <ListNav />
          <ShortcutHelp />
        </>
      }
    >
      {smoke ? (
        <Suspense fallback={null}>
          <DataverseSmoke />
        </Suspense>
      ) : (
        <Routes>
          <Route path="/list/:id" element={<ListRoute />} />
          <Route path="/completed" element={<CompletedRoute />} />
          <Route path="*" element={<InboxRedirect />} />
        </Routes>
      )}
    </AppShell>
  );
}

/** Lands on the Inbox until the Today view becomes the default in task 10. */
function InboxRedirect() {
  const inbox = useInbox();
  if (inbox.data) return <Navigate to={`/list/${inbox.data.id}`} replace />;
  if (inbox.isError)
    return <p role="alert">Your Inbox didn't load. Reload the app to try again.</p>;
  return null;
}
