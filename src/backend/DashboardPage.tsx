import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LogOut,
  MailCheck,
  Plus,
  Route,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

type TeamSummary = FunctionReturnType<typeof api.teams.listMine>[number];
type Discovery = FunctionReturnType<typeof api.journeyActions.discover>;
type Candidate = Discovery["candidates"][number];
type AlertStatus = FunctionReturnType<typeof api.alerts.getStatus>;

export default function DashboardPage() {
  const teams = useQuery(api.teams.listMine);
  const createTeam = useMutation(api.teams.create);
  const claimSetup = useMutation(api.intake.claimSetup);
  const { signOut } = useAuthActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const setupToken = searchParams.get("setup");
  const [teamName, setTeamName] = useState("");
  const [setupState, setSetupState] = useState<
    "idle" | "claiming" | "claimed" | "failed"
  >(setupToken ? "claiming" : "idle");
  const [setupError, setSetupError] = useState("");
  useEffect(() => {
    if (!setupToken || setupState !== "claiming") return;
    void claimSetup({ token: setupToken })
      .then((setup) => {
        const next = new URLSearchParams(searchParams);
        next.delete("setup");
        next.set("team", setup.teamId);
        next.set("start", "1");
        setSearchParams(next, { replace: true });
        setSetupState("claimed");
      })
      .catch((reason: unknown) => {
        setSetupError(
          reason instanceof Error ? reason.message : "This setup link could not be verified",
        );
        setSetupState("failed");
      });
  }, [claimSetup, searchParams, setSearchParams, setupState, setupToken]);
  if (setupToken && setupState === "claiming") return <WorkspaceLoader />;
  if (setupToken && setupState === "failed") {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0b0e0c] p-6 text-[#f3efe6]">
        <Card className="w-full max-w-lg border-white/20 bg-white/[.03] text-white">
          <CardHeader>
            <Badge variant="outline" className="w-fit border-white/25 bg-transparent text-white">Private setup</Badge>
            <CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">This link could not be verified.</CardTitle>
            <CardDescription className="text-white/60">{setupError}</CardDescription>
          </CardHeader>
          <CardContent><Button className="w-full rounded-full bg-[#c8ff53] text-[#111612]" onClick={() => void signOut()}>Sign in with a different email</Button></CardContent>
        </Card>
      </main>
    );
  }
  if (teams === undefined) return <WorkspaceLoader />;
  const invitationToken = searchParams.get("invite");
  if (invitationToken) {
    return (
      <InvitationAcceptance
        token={invitationToken}
        onComplete={(teamId) => setSearchParams({ team: teamId })}
      />
    );
  }
  if (teams.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f3efe6] p-6">
        <Card className="w-full max-w-lg border-black/20 bg-transparent shadow-none">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full">Private workspace</Badge>
            <CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">Name the business you protect.</CardTitle>
            <CardDescription>Lead-form checks, results, alerts, and team access stay inside this private workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => { event.preventDefault(); void createTeam({ name: teamName }); }}>
              <Label htmlFor="team-name">Business or team name</Label>
              <Input id="team-name" value={teamName} onChange={(event) => setTeamName(event.target.value)} className="mt-2 h-12" minLength={2} maxLength={60} required />
              <Button className="mt-5 w-full rounded-full" type="submit">Create private workspace <ArrowRight /></Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }
  const requestedTeamId = searchParams.get("team");
  const selectedTeam = teams.find((team) => team._id === requestedTeamId) ?? teams[0];
  return (
    <TeamDashboard
      team={selectedTeam}
      continueSetup={searchParams.get("start") === "1"}
      onSignOut={() => void signOut()}
    />
  );
}

function InvitationAcceptance({ token, onComplete }: { token: string; onComplete: (teamId: Id<"teams">) => void }) {
  const acceptInvitation = useMutation(api.teams.acceptInvitation);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-[#0b0e0c] p-6 text-[#f3efe6]">
      <Card className="w-full max-w-lg border-white/20 bg-white/[.03] text-white">
        <CardHeader><Badge className="w-fit bg-[#c8ff53] text-[#111612]">Private invitation</Badge><CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">Join this workspace.</CardTitle><CardDescription className="text-white/55">Your signed-in email must match the invitation.</CardDescription></CardHeader>
        <CardContent>
          {error && <p role="alert" className="mb-4 text-sm text-[#ff9b8b]">{error}</p>}
          <Button className="h-12 w-full rounded-full bg-[#c8ff53] text-[#111612]" disabled={pending} onClick={() => { setPending(true); setError(""); void acceptInvitation({ token }).then(onComplete).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Invitation could not be accepted")).finally(() => setPending(false)); }}>{pending ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />} Accept invitation</Button>
        </CardContent>
      </Card>
    </main>
  );
}

function TeamDashboard({ team, continueSetup, onSignOut }: { team: TeamSummary; continueSetup: boolean; onSignOut: () => void }) {
  const business = useQuery(api.journeys.getBusiness, { teamId: team._id });
  const journeys = useQuery(api.journeys.list, { teamId: team._id });
  const alertStatus = useQuery(api.alerts.getStatus, { teamId: team._id });
  if (business === undefined || journeys === undefined || alertStatus === undefined) return <WorkspaceLoader />;
  const healthy = journeys.filter((journey) => journey.status === "healthy").length;
  const openIncidents = journeys.reduce((sum, journey) => sum + journey.openIncidentCount, 0);
  return (
    <div className="min-h-screen bg-[#f3efe6]">
      <header className="grid h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-black/20 px-3 sm:gap-4 sm:px-5 md:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-2 font-semibold" aria-label="Signal Garden home"><span className="grid size-6 place-items-center rounded-full bg-[#111612] text-[9px] text-[#c8ff53]">SG</span><span className="hidden sm:inline">Signal Garden</span></Link>
        <p className="truncate text-center text-sm font-medium text-black/60">{team.name}</p>
        <Button variant="ghost" size="sm" aria-label="Sign out" onClick={onSignOut}><LogOut /><span className="hidden sm:inline">Sign out</span></Button>
      </header>
      <main className="px-5 py-10 md:px-8 lg:px-12">
        {business === null || journeys.length === 0 ? (
          <BusinessOnboarding
            team={team}
            initialWebsite={business?.websiteUrl ?? ""}
            initialBusinessName={business?.displayName ?? team.name}
            verifiedSetup={continueSetup}
          />
        ) : (
          <>
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div><p className="eyebrow">{business.displayName} · {new URL(business.websiteUrl).hostname}</p><h1 className="mt-4 text-6xl font-semibold tracking-[-.068em] md:text-8xl">Protect your lead form.</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-black/58">Signal Garden checks this form every day and emails the owner when the page, submission, or expected confirmation fails.</p></div>
              <AlertTestButton team={team} status={alertStatus} />
            </div>
            {alertStatus.alertDeliveryProblemCount > 0 && <div role="alert" className="mt-7 flex items-start gap-3 border border-[#d54f3d]/35 bg-[#d54f3d]/8 p-4 text-sm text-[#8d2e21]"><CircleAlert className="mt-0.5 size-4 shrink-0" /><p>An earlier failure email could not be delivered after five attempts. Send a test alert to verify the owner inbox before relying on monitoring.</p></div>}
            <div className="mt-10 grid gap-px border border-black/20 bg-black/20 sm:grid-cols-3">
              <Metric label="Checks configured" value={journeys.length} icon={Route} />
              <Metric label="Healthy now" value={healthy} icon={CheckCircle2} />
              <Metric label="Open failures" value={openIncidents} icon={CircleAlert} alert={openIncidents > 0} />
            </div>
            <div className="mt-12 grid gap-px border border-black/20 bg-black/20 md:grid-cols-2 xl:grid-cols-3">
              {journeys.map((journey, index) => <JourneyCard key={journey._id} journey={journey} index={index} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, icon: Icon, alert = false }: { label: string; value: number; icon: typeof Route; alert?: boolean }) {
  return <div className="flex items-end justify-between bg-[#f3efe6] p-5"><div><p className="text-4xl font-semibold tracking-[-.06em]">{value}</p><p className="mt-2 text-xs text-black/52">{label}</p></div><Icon className={alert ? "size-5 text-[#d54f3d]" : "size-5 text-[#4f7134]"} /></div>;
}

function AlertTestButton({ team, status }: { team: TeamSummary; status: AlertStatus }) {
  const sendTestAlert = useAction(api.alertActions.sendTestAlert);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (team.role !== "owner") return null;
  return (
    <div className="text-left md:text-right">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full border-black/25 bg-transparent"
        disabled={pending || !status.enabled}
        onClick={() => {
          setPending(true);
          setMessage("");
          setError("");
          void sendTestAlert({ teamId: team._id })
            .then(() => setMessage("Test alert delivered."))
            .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The test alert could not be delivered"))
            .finally(() => setPending(false));
        }}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <MailCheck />}
        Send test alert
      </Button>
      <p className={`mt-2 max-w-64 text-[11px] ${error ? "text-[#a83222]" : "text-black/50"}`} role={error ? "alert" : "status"}>
        {error || message || (status?.enabled ? "Failure emails go to the workspace owner." : "A valid owner email is required for alerts.")}
      </p>
    </div>
  );
}

function JourneyCard({ journey, index }: { journey: FunctionReturnType<typeof api.journeys.list>[number]; index: number }) {
  const statusLabel = journey.status === "incident" ? "Check failed" : journey.status === "needs_review" ? "Needs review" : journey.enabled ? journey.status : "Paused";
  return (
    <Link to={`journeys/${journey._id}`} className="group min-h-[270px] bg-[#f3efe6] p-6 transition hover:bg-[#e8e2d7]">
      <div className="flex justify-between"><Badge variant="outline" className={journey.status === "incident" ? "border-[#d54f3d]/50 bg-[#d54f3d]/8 text-[#a83222]" : "border-black/25 bg-transparent"}>{statusLabel}</Badge><span className="font-mono text-xs text-black/50">0{index + 1}</span></div>
      <h2 className="mt-16 text-3xl font-semibold leading-[.96] tracking-[-.045em]">{journey.name}</h2>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-black/55">{journey.goal}</p>
      <div className="mt-7 flex items-center justify-between text-xs text-black/50"><span>{journey.latestRun ? `Last checked ${formatRelative(journey.latestRun.startedAt)}` : "Not checked yet"}</span><ArrowRight className="size-4 transition group-hover:translate-x-1" /></div>
    </Link>
  );
}

function BusinessOnboarding({ team, initialWebsite = "", initialBusinessName = team.name, verifiedSetup = false }: { team: TeamSummary; initialWebsite?: string; initialBusinessName?: string; verifiedSetup?: boolean }) {
  return (
    <div className="grid min-h-[calc(100vh-152px)] items-center gap-10 lg:grid-cols-[.78fr_1.22fr]">
      <div><p className="eyebrow">Start with one form / 01</p><h1 className="mt-5 text-6xl font-semibold leading-[.86] tracking-[-.068em] md:text-8xl">Which lead form should we protect?</h1><p className="mt-6 max-w-lg text-lg leading-relaxed text-black/58">{verifiedSetup ? "Your emailed setup link was verified. Confirm the website below and we will find the public form closest to a new customer." : "Enter the business website. Signal Garden finds one safe public contact, quote, or demo form. You approve it before any test is submitted."}</p></div>
      <DiscoveryPanel team={team} initialWebsite={initialWebsite} initialBusinessName={initialBusinessName} />
    </div>
  );
}

function DiscoveryPanel({ team, initialWebsite = "", initialBusinessName = team.name }: { team: TeamSummary; initialWebsite?: string; initialBusinessName?: string }) {
  const discover = useAction(api.journeyActions.discover);
  const upsertBusiness = useMutation(api.journeys.upsertBusiness);
  const createJourney = useMutation(api.journeys.create);
  const navigate = useNavigate();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite);
  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div className="border border-black/20 bg-[#0b0e0c] p-6 text-[#f3efe6] md:p-10">
      {discovery === null ? (
        <form onSubmit={(event) => { event.preventDefault(); setPending(true); setError(""); void discover({ teamId: team._id, websiteUrl }).then(async (result) => { await upsertBusiness({ teamId: team._id, websiteUrl: result.websiteUrl, displayName: businessName, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }); setDiscovery(result); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The public website could not be mapped")).finally(() => setPending(false)); }}>
          <div><Label htmlFor="business-name">Business name</Label><Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} minLength={2} maxLength={80} required className="mt-2 h-12 border-white/22 bg-white/[.04] text-white" /></div>
          <div className="mt-5"><Label htmlFor="website-url">Public website</Label><Input id="website-url" type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourbusiness.com" required className="mt-2 h-12 border-white/22 bg-white/[.04] text-white" /></div>
          {error && <p role="alert" className="mt-4 text-sm text-[#ff9b8b]">{error}</p>}
          <Button type="submit" disabled={pending} style={{ background: "#c8ff53", color: "#111612" }} className="mt-6 h-12 w-full rounded-full">{pending ? <><LoaderCircle className="animate-spin" /> Finding public forms…</> : <>Find my lead form <ArrowRight /></>}</Button>
          <p className="mt-4 text-center text-[11px] text-white/65">This step only reads public pages. It does not submit a form.</p>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[#4f7134]">{discovery.siteName}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Choose the form closest to revenue.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/55">{discovery.summary}</p></div><Button variant="ghost" size="sm" onClick={() => setDiscovery(null)}>Change site</Button></div>
          <div className="mt-6 space-y-3">
            {discovery.candidates.map((candidate) => <CandidateCard key={`${candidate.kind}-${candidate.startUrl}`} candidate={candidate} pending={creating === candidate.startUrl} onCreate={() => { setCreating(candidate.startUrl); setError(""); void createJourney({ teamId: team._id, name: candidate.name, kind: candidate.kind, startUrl: candidate.startUrl, goal: candidate.goal, expectedReplyMinutes: candidate.expectedReplyMinutes, cadence: "daily", expectsConfirmation: candidate.expectsConfirmation, expectsHumanReply: false, ...(candidate.expectedSenderDomain ? { expectedSenderDomain: candidate.expectedSenderDomain } : {}) }).then((journeyId) => navigate(`/app/journeys/${journeyId}`)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The lead-form check could not be created")).finally(() => setCreating(null)); }} />)}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#a83222]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate, pending, onCreate }: { candidate: Candidate; pending: boolean; onCreate: () => void }) {
  return (
    <article className="border border-black/20 bg-white/35 p-5">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Badge variant="outline" className="border-black/20 bg-transparent">{candidate.kind.replace("_", " ")}</Badge><span className="flex items-center gap-1 text-[11px] text-black/45"><MailCheck className="size-3" /> {candidate.expectsConfirmation ? `Waits up to ${candidate.expectedReplyMinutes} min for confirmation` : "Checks the on-page success result"}</span></div><h3 className="mt-3 text-2xl font-semibold tracking-[-.035em]">{candidate.name}</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-black/58">{candidate.whyItMatters}</p><p className="mt-2 text-xs text-black/40">{new URL(candidate.startUrl).pathname || "/"}</p></div><Button disabled={pending} onClick={onCreate} className="shrink-0 rounded-full">{pending ? <LoaderCircle className="animate-spin" /> : <Plus />} Monitor this form daily</Button></div>
    </article>
  );
}

function formatRelative(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
