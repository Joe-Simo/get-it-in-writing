import { lazy, Suspense } from "react";
import { Authenticated, Unauthenticated } from "convex/react";
import { Navigate, Route, Routes } from "react-router-dom";
import SignInPage from "@/backend/SignInPage";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

const DashboardPage = lazy(() => import("@/backend/DashboardPage"));
const MissionWorkspacePage = lazy(
  () => import("@/backend/MissionWorkspacePage"),
);

export default function BackendApp() {
  return (
    <>
      <Authenticated>
        <Suspense fallback={<WorkspaceLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/missions/:missionId"
              element={<MissionWorkspacePage />}
            />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </Suspense>
      </Authenticated>
      <Unauthenticated>
        <SignInPage />
      </Unauthenticated>
    </>
  );
}
