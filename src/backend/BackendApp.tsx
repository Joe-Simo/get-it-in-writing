import { Component, lazy, Suspense, type ReactNode } from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "@/backend/AppShell";
import SignInPage from "@/backend/SignInPage";
import WorkspaceLoader from "@/backend/WorkspaceLoader";

const DashboardPage = lazy(() => import("@/backend/DashboardPage"));
const NewDecisionPage = lazy(() => import("@/backend/NewDecisionPage"));
const DecisionPage = lazy(() => import("@/backend/DecisionPage"));

export default function BackendApp() {
  return (
    <>
      <Authenticated>
        <WorkspaceErrorBoundary>
          <Suspense fallback={<WorkspaceLoader />}>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="new" element={<NewDecisionPage />} />
                <Route path="decisions/:decisionId" element={<DecisionPage />} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Route>
            </Routes>
          </Suspense>
        </WorkspaceErrorBoundary>
      </Authenticated>
      <Unauthenticated><SignInPage /></Unauthenticated>
    </>
  );
}

class WorkspaceErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-screen place-items-center bg-paper p-6 text-ink">
        <section className="ticket-shell max-w-xl p-8 text-center" role="alert">
          <p className="ink-label">Private workspace</p>
          <h1 className="mt-4 font-[family-name:var(--font-editorial)] text-5xl leading-[.9]">
            Your wallet could not load safely.
          </h1>
          <p className="mt-5 text-[#555b56]">
            Your cases were not changed. Reload to reconnect to this project’s private backend.
          </p>
          <button
            type="button"
            className="mt-7 min-h-12 bg-ink px-6 text-sm font-semibold text-paper"
            onClick={() => window.location.reload()}
          >
            Reload private wallet
          </button>
        </section>
      </main>
    );
  }
}
