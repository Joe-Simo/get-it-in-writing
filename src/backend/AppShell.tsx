import { useAuthActions } from "@convex-dev/auth/react";
import { LockKeyhole, LogOut, Plus } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

export default function AppShell() {
  const { signOut } = useAuthActions();
  return (
    <div className="min-h-screen bg-paper text-ink">
      <a href="#workspace-main" className="skip-link">Skip to workspace</a>
      <header className="app-header">
        <Brand compact />
        <nav aria-label="Promise Wallet navigation" className="app-nav">
          <NavLink to="/app" end>Promise Wallet</NavLink>
          <Button asChild className="rounded-full bg-cobalt text-white hover:bg-[#153ae8]">
            <NavLink to="/app/new"><Plus aria-hidden="true" /> New decision</NavLink>
          </Button>
          <button type="button" className="icon-button" aria-label="Sign out" onClick={() => void signOut()}><LogOut aria-hidden="true" /></button>
        </nav>
      </header>
      <aside className="privacy-ribbon" aria-label="Privacy boundary"><LockKeyhole aria-hidden="true" /> Private workspace · You approve every outgoing message</aside>
      <main id="workspace-main" className="app-main"><Outlet /></main>
    </div>
  );
}
