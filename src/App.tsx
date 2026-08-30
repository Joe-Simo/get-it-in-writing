import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import LandingPage from "@/marketing/LandingPage";

const BackendApp = lazy(() => import("@/backend/BackendApp"));
const backendConfigured = Boolean(import.meta.env.VITE_CONVEX_URL);

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route
              path="/app/*"
              element={backendConfigured ? <BackendApp /> : <LocalSetupNotice />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
}

function RouteLoader() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f2efe7] text-[#101511]">
      <span className="size-5 animate-pulse rounded-full bg-[#244cff]" />
      <span className="sr-only">Loading Get It in Writing</span>
    </main>
  );
}

function LocalSetupNotice() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f2efe7] p-6 text-[#101511]">
      <div className="max-w-lg border border-black/20 p-8">
        <p className="ink-label">Local setup</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-.055em]">
          Connect this project’s private decision backend.
        </h1>
        <p className="mt-5 text-black/60">
          Set VITE_CONVEX_URL for this project before opening the Promise Wallet.
        </p>
      </div>
    </main>
  );
}
