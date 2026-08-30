import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LogOut,
  MailCheck,
  Plus,
  Radar,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

type TeamSummary = FunctionReturnType<typeof api.teams.listMine>[number];
type Discovery = FunctionReturnType<typeof api.journeyActions.discover>;
type Candidate = Discovery["candidates"][number];

export default function DashboardPage() {
  const teams = useQuery(api.teams.listMine);
  const createTeam = useMutation(api.teams.create);
  const { signOut } = useAuthActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [teamName, setTeamName] = useState("");
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
            <CardDescription>Lead-form checks, evidence, alerts, and team access stay inside this private workspace.</CardDescription>
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
      teams={teams}
      team={selectedTeam}
      onTeamChange={(teamId) => setSearchParams({ team: teamId })}
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

function TeamDashboard({ teams, team, onTeamChange, onSignOut }: { teams: TeamSummary[]; team: TeamSummary; onTeamChange: (teamId: string) => void; onSignOut: () => void }) {
  const business = useQuery(api.journeys.getBusiness, { teamId: team._id });
  const journeys = useQuery(api.journeys.list, { teamId: team._id });
  if (business === undefined || journeys === undefined) return <WorkspaceLoader />;
  const healthy = journeys.filter((journey) => journey.status === "healthy").length;
  const openIncidents = journeys.reduce((sum, journey) => sum + journey.openIncidentCount, 0);
  return (
    <div className="min-h-screen bg-[#f3efe6]">
      <header className="grid h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-black/20 px-3 sm:gap-4 sm:px-5 md:px-8 lg:px-12">
        <Link to="/" className="flex items-center gap-2 font-semibold" aria-label="Signal Garden home"><span className="grid size-6 place-items-center rounded-full bg-[#111612] text-[9px] text-[#c8ff53]">SG</span><span className="hidden sm:inline">Signal Garden</span></Link>
        <Select value={team._id} onValueChange={onTeamChange}>
          <SelectTrigger aria-label="Active workspace" className="h-9 w-full max-w-[240px] justify-self-center border-black/25 bg-transparent"><Building2 className="size-4" /><SelectValue /></SelectTrigger>
          <SelectContent>{teams.map((availableTeam) => <SelectItem key={availableTeam._id} value={availableTeam._id}>{availableTeam.name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1"><CreateTeamDialog onCreated={onTeamChange} /><Button variant="ghost" size="sm" aria-label="Sign out" onClick={onSignOut}><LogOut /><span className="hidden sm:inline">Sign out</span></Button></div>
      </header>
      <main className="px-5 py-10 md:px-8 lg:px-12">
        {business === null ? (
          <BusinessOnboarding team={team} />
        ) : (
          <>
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <div><p className="eyebrow">{business.displayName} · {new URL(business.websiteUrl).hostname}</p><h1 className="mt-4 text-6xl font-semibold tracking-[-.068em] md:text-8xl">Protect your lead forms.</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-black/58">Signal Garden checks the form on schedule and emails the owner when the page, submission, or confirmation fails.</p></div>
              <div className="flex flex-col items-start gap-3 md:items-end"><AlertTestButton team={team} /><DiscoveryDialog team={team} initialWebsite={business.websiteUrl} /></div>
            </div>
            <div className="mt-10 grid gap-px border border-black/20 bg-black/20 sm:grid-cols-3">
              <Metric label="Checks configured" value={journeys.length} icon={Route} />
              <Metric label="Healthy now" value={healthy} icon={CheckCircle2} />
              <Metric label="Open failures" value={openIncidents} icon={CircleAlert} alert={openIncidents > 0} />
            </div>
            <div className="mt-12 grid gap-px border border-black/20 bg-black/20 md:grid-cols-2 xl:grid-cols-3">
              {journeys.map((journey, index) => <JourneyCard key={journey._id} journey={journey} index={index} />)}
              {journeys.length === 0 && (
                <div className="col-span-full grid min-h-72 place-items-center bg-[#f3efe6] p-10 text-center"><div><Radar className="mx-auto size-7 text-black/45" /><h2 className="mt-4 text-2xl font-semibold tracking-[-.04em]">No lead-form check yet.</h2><p className="mt-2 text-sm text-black/55">Find the public form closest to a new customer.</p><div className="mt-6"><DiscoveryDialog team={team} initialWebsite={business.websiteUrl} compact /></div></div></div>
              )}
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

function AlertTestButton({ team }: { team: TeamSummary }) {
  const status = useQuery(api.alerts.getStatus, { teamId: team._id });
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
        disabled={pending || status === undefined || !status.enabled}
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
  const statusLabel = journey.status === "incident" ? "Check failed" : journey.enabled ? journey.status : "Draft";
  return (
    <Link to={`journeys/${journey._id}`} className="group min-h-[270px] bg-[#f3efe6] p-6 transition hover:bg-[#e8e2d7]">
      <div className="flex justify-between"><Badge variant="outline" className={journey.status === "incident" ? "border-[#d54f3d]/50 bg-[#d54f3d]/8 text-[#a83222]" : "border-black/25 bg-transparent"}>{statusLabel}</Badge><span className="font-mono text-xs text-black/50">0{index + 1}</span></div>
      <h2 className="mt-16 text-3xl font-semibold leading-[.96] tracking-[-.045em]">{journey.name}</h2>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-black/55">{journey.goal}</p>
      <div className="mt-7 flex items-center justify-between text-xs text-black/50"><span>{journey.latestRun ? `Last checked ${formatRelative(journey.latestRun.startedAt)}` : "Not checked yet"}</span><ArrowRight className="size-4 transition group-hover:translate-x-1" /></div>
    </Link>
  );
}

function BusinessOnboarding({ team }: { team: TeamSummary }) {
  return (
    <div className="grid min-h-[calc(100vh-152px)] items-center gap-10 lg:grid-cols-[.78fr_1.22fr]">
      <div><p className="eyebrow">Start with one form / 01</p><h1 className="mt-5 text-6xl font-semibold leading-[.86] tracking-[-.068em] md:text-8xl">Which lead form should we protect first?</h1><p className="mt-6 max-w-lg text-lg leading-relaxed text-black/58">Enter the business website. Signal Garden finds safe public contact, quote, and demo forms. You approve the exact form before any test is submitted.</p></div>
      <DiscoveryPanel team={team} />
    </div>
  );
}

function DiscoveryDialog({ team, initialWebsite, compact = false }: { team: TeamSummary; initialWebsite: string; compact?: boolean }) {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="h-11 rounded-full px-5">{compact ? "Find first form" : "New lead-form check"} <Plus /></Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-black/20 bg-[#f3efe6] sm:max-w-3xl">
        <DialogHeader><DialogTitle className="text-3xl tracking-[-.045em]">Find a lead form worth protecting.</DialogTitle><DialogDescription>Signal Garden reads the public website and proposes only safe lead, contact, quote, and demo forms.</DialogDescription></DialogHeader>
        <DiscoveryPanel team={team} initialWebsite={initialWebsite} embedded />
      </DialogContent>
    </Dialog>
  );
}

function DiscoveryPanel({ team, initialWebsite = "", embedded = false }: { team: TeamSummary; initialWebsite?: string; embedded?: boolean }) {
  const discover = useAction(api.journeyActions.discover);
  const upsertBusiness = useMutation(api.journeys.upsertBusiness);
  const createJourney = useMutation(api.journeys.create);
  const navigate = useNavigate();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsite);
  const [businessName, setBusinessName] = useState(team.name);
  const [discovery, setDiscovery] = useState<Discovery | null>(null);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState("");
  return (
    <div className={embedded ? "pt-3" : "border border-black/20 bg-[#0b0e0c] p-6 text-[#f3efe6] md:p-10"}>
      {discovery === null ? (
        <form onSubmit={(event) => { event.preventDefault(); setPending(true); setError(""); void discover({ teamId: team._id, websiteUrl }).then(async (result) => { await upsertBusiness({ teamId: team._id, websiteUrl: result.websiteUrl, displayName: businessName, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }); setDiscovery(result); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The public website could not be mapped")).finally(() => setPending(false)); }}>
          <div><Label htmlFor={`business-name-${embedded}`}>Business name</Label><Input id={`business-name-${embedded}`} value={businessName} onChange={(event) => setBusinessName(event.target.value)} minLength={2} maxLength={80} required className={embedded ? "mt-2 h-12" : "mt-2 h-12 border-white/22 bg-white/[.04] text-white"} /></div>
          <div className="mt-5"><Label htmlFor={`website-url-${embedded}`}>Public website</Label><Input id={`website-url-${embedded}`} type="url" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} placeholder="https://yourbusiness.com" required className={embedded ? "mt-2 h-12" : "mt-2 h-12 border-white/22 bg-white/[.04] text-white"} /></div>
          {error && <p role="alert" className={embedded ? "mt-4 text-sm text-[#a83222]" : "mt-4 text-sm text-[#ff9b8b]"}>{error}</p>}
          <Button type="submit" disabled={pending} style={embedded ? undefined : { background: "#c8ff53", color: "#111612" }} className="mt-6 h-12 w-full rounded-full">{pending ? <><LoaderCircle className="animate-spin" /> Finding public forms…</> : <>Find lead forms <ArrowRight /></>}</Button>
          <p className={embedded ? "mt-4 text-center text-[11px] text-black/65" : "mt-4 text-center text-[11px] text-white/65"}>Discovery reads public pages only. It does not submit a form.</p>
        </form>
      ) : (
        <div>
          <div className="flex items-start justify-between gap-4"><div><p className="eyebrow text-[#4f7134]">{discovery.siteName}</p><h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Choose the form closest to revenue.</h2><p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/55">{discovery.summary}</p></div><Button variant="ghost" size="sm" onClick={() => setDiscovery(null)}>Change site</Button></div>
          <div className="mt-6 space-y-3">
            {discovery.candidates.map((candidate) => <CandidateCard key={`${candidate.kind}-${candidate.startUrl}`} candidate={candidate} pending={creating === candidate.startUrl} onCreate={(settings) => { setCreating(candidate.startUrl); setError(""); void createJourney({ teamId: team._id, name: candidate.name, kind: candidate.kind, startUrl: candidate.startUrl, goal: candidate.goal, expectedReplyMinutes: candidate.expectedReplyMinutes, cadence: settings.cadence, expectsConfirmation: settings.expectsConfirmation, expectsHumanReply: false, ...(candidate.expectedSenderDomain ? { expectedSenderDomain: candidate.expectedSenderDomain } : {}) }).then((journeyId) => navigate(`/app/journeys/${journeyId}`)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The lead-form check could not be created")).finally(() => setCreating(null)); }} />)}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#a83222]">{error}</p>}
        </div>
      )}
    </div>
  );
}

function CandidateCard({ candidate, pending, onCreate }: { candidate: Candidate; pending: boolean; onCreate: (settings: { cadence: "manual" | "daily" | "weekly"; expectsConfirmation: boolean }) => void }) {
  const [cadence, setCadence] = useState<"manual" | "daily" | "weekly">("daily");
  const [confirmation, setConfirmation] = useState(candidate.expectsConfirmation);
  return (
    <article className="border border-black/20 bg-white/35 p-5">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><div className="flex items-center gap-2"><Badge variant="outline" className="border-black/20 bg-transparent">{candidate.kind.replace("_", " ")}</Badge>{confirmation && <span className="flex items-center gap-1 text-[11px] text-black/45"><MailCheck className="size-3" /> Checks confirmation</span>}</div><h3 className="mt-3 text-2xl font-semibold tracking-[-.035em]">{candidate.name}</h3><p className="mt-2 max-w-xl text-sm leading-relaxed text-black/58">{candidate.whyItMatters}</p><p className="mt-2 text-xs text-black/40">{new URL(candidate.startUrl).pathname || "/"}</p></div><Button disabled={pending} onClick={() => onCreate({ cadence, expectsConfirmation: confirmation })} className="shrink-0 rounded-full">{pending ? <LoaderCircle className="animate-spin" /> : <Plus />} Protect this form</Button></div>
      <div className="mt-5 grid gap-4 border-t border-black/12 pt-4 sm:grid-cols-2">
        <div><Label htmlFor={`cadence-${candidate.startUrl}`} className="text-xs">Check frequency</Label><Select value={cadence} onValueChange={(value) => setCadence(value as typeof cadence)}><SelectTrigger id={`cadence-${candidate.startUrl}`} className="mt-2 h-9 bg-transparent"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual</SelectItem><SelectItem value="daily">Every day</SelectItem><SelectItem value="weekly">Every week</SelectItem></SelectContent></Select></div>
        <label className="flex items-center justify-between gap-3 text-xs">Check confirmation email <Switch checked={confirmation} onCheckedChange={setConfirmation} /></label>
      </div>
    </article>
  );
}

function CreateTeamDialog({ onCreated }: { onCreated: (teamId: string) => void }) {
  const createTeam = useMutation(api.teams.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" aria-label="New workspace"><Plus /><span className="hidden sm:inline">Workspace</span></Button></DialogTrigger>
      <DialogContent className="bg-[#f3efe6]"><DialogHeader><DialogTitle>New private workspace</DialogTitle><DialogDescription>Use a separate workspace when lead-form checks belong to another business.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void createTeam({ name }).then((teamId) => { onCreated(teamId); setOpen(false); setName(""); }); }}><Label htmlFor="new-workspace">Business or team name</Label><Input id="new-workspace" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required className="mt-2" /><Button className="mt-5 w-full rounded-full" type="submit">Create private workspace</Button></form></DialogContent>
    </Dialog>
  );
}

function formatRelative(timestamp: number) {
  const minutes = Math.max(1, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
