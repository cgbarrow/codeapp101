import { lazy, Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { AppShell } from "@/components/AppShell/AppShell";
import { ListNav } from "@/components/ListNav/ListNav";
import { ReminderStatus } from "@/components/ReminderStatus/ReminderStatus";
import { ShortcutHelp } from "@/components/ShortcutHelp/ShortcutHelp";
import { useLists } from "@/data/queries";
import { landingPath, readLastView, saveLastView } from "@/features/today/lastView";
import { useReminders } from "@/hooks/useNotifications";
import { CompletedRoute } from "@/routes/CompletedRoute";
import { ListRoute } from "@/routes/ListRoute";
import { TodayRoute } from "@/routes/TodayRoute";

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
  useReminders();
  const { pathname } = useLocation();
  useEffect(() => saveLastView(pathname), [pathname]);

  return (
    <AppShell
      sidebar={
        <>
          <ListNav />
          <ReminderStatus />
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
          <Route path="/today" element={<TodayRoute />} />
          <Route path="/list/:id" element={<ListRoute />} />
          <Route path="/completed" element={<CompletedRoute />} />
          <Route path="*" element={<LandingRedirect />} />
        </Routes>
      )}
    </AppShell>
  );
}

/** Opens the last view the user had, or Today. Waits for the lists to check a list still exists. */
function LandingRedirect() {
  const lists = useLists();
  const stored = readLastView();
  const needsLists = stored?.startsWith("/list/") ?? false;
  if (needsLists && lists.isPending) return null;
  return <Navigate to={landingPath(stored, lists.data ?? [])} replace />;
}
