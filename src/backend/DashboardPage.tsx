import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Building2,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LogOut,
  MailCheck,
  FileCheck2,
  Plus,
  Radar,
  Send,
  UserPlus,
} from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

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
  if (teams.length === 0)
    return (
      <main className="grid min-h-screen place-items-center bg-[#f2eee5] p-6">
        <Card className="w-full max-w-lg border-black/20 bg-transparent shadow-none">
          <CardHeader>
            <Badge variant="outline" className="w-fit">
              First decision
            </Badge>
            <CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">
              Name your bid team.
            </CardTitle>
            <CardDescription>
              This creates a private boundary for packages, impacts, contacts,
              and release records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void createTeam({ name: teamName });
              }}
            >
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={teamName}
                onChange={(event) => setTeamName(event.target.value)}
                className="mt-2 h-12"
                minLength={2}
                maxLength={60}
                required
              />
              <Button className="mt-5 w-full rounded-full" type="submit">
                Create private team <ArrowRight />
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  const requestedTeamId = searchParams.get("team");
  const selectedTeam =
    teams.find((team) => team._id === requestedTeamId) ?? teams[0];
  return (
    <TeamDashboard
      teams={teams}
      team={selectedTeam}
      onTeamChange={(teamId) => setSearchParams({ team: teamId })}
      onSignOut={() => void signOut()}
    />
  );
}

function InvitationAcceptance({
  token,
  onComplete,
}: {
  token: string;
  onComplete: (teamId: Id<"teams">) => void;
}) {
  const acceptInvitation = useMutation(api.teams.acceptInvitation);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-screen place-items-center bg-[#0a0d0b] p-6 text-[#f2eee5]">
      <Card className="w-full max-w-lg border-white/20 bg-white/[.03] text-white">
        <CardHeader>
          <Badge className="w-fit bg-[#c7ff4a] text-[#111612]">
            Private invitation
          </Badge>
          <CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">
            Join the bid team.
          </CardTitle>
          <CardDescription className="text-white/55">
            Signal Garden will verify that your signed-in email matches the
            invitation before adding access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <p role="alert" className="mb-4 text-sm text-[#ff9b8b]">
              {error}
            </p>
          )}
          <Button
            className="h-12 w-full rounded-full bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
            disabled={pending}
            onClick={() => {
              setPending(true);
              setError("");
              void acceptInvitation({ token })
                .then(onComplete)
                .catch((reason: unknown) =>
                  setError(
                    reason instanceof Error
                      ? reason.message
                      : "Invitation could not be accepted",
                  ),
                )
                .finally(() => setPending(false));
            }}
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}{" "}
            Accept invitation
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

type MissionSummary = {
  _id: Id<"missions">;
  question: string;
  workflowKind?: "research" | "prebid";
  opportunityTitle?: string;
  solicitationNumber?: string;
  agency?: string;
  bidDueAt?: number;
  decision?: "undecided" | "bid" | "no_bid";
  releaseState?: "blocked" | "ready" | "approved";
  reviewState?: "current" | "change_detected";
  lastPackageCheckedAt?: number;
  status: string;
  sourceCount: number;
  claimCount: number;
};

type TeamSummary = {
  _id: Id<"teams">;
  name: string;
  slug: string;
  role: "owner" | "member";
  reviewEmail?: string;
};

function TeamDashboard({
  teams,
  team,
  onTeamChange,
  onSignOut,
}: {
  teams: TeamSummary[];
  team: TeamSummary;
  onTeamChange: (teamId: string) => void;
  onSignOut: () => void;
}) {
  const missions = useQuery(api.missions.list, { teamId: team._id });
  return (
    <div className="min-h-screen bg-[#f2eee5]">
      <header className="grid h-[72px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-black/20 px-3 sm:gap-4 sm:px-5 md:px-8 lg:px-12">
        <Link to="/" className="font-semibold" aria-label="Signal Garden home">
          <span aria-hidden="true" className="sm:hidden">
            ◉
          </span>
          <span className="hidden sm:inline">◉ Signal Garden</span>
        </Link>
        <Select value={team._id} onValueChange={onTeamChange}>
          <SelectTrigger
            aria-label="Active team"
            className="h-9 w-full max-w-[240px] justify-self-center border-black/25 bg-transparent"
          >
            <Building2 className="size-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teams.map((availableTeam) => (
              <SelectItem key={availableTeam._id} value={availableTeam._id}>
                {availableTeam.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <CreateTeamDialog onCreated={onTeamChange} />
          {team.role === "owner" && (
            <TeamReviewRouteDialog key={team._id} team={team} />
          )}
          {team.role === "owner" && <TeamInviteDialog teamId={team._id} />}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Sign out"
            onClick={onSignOut}
          >
            <LogOut /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>
      <main className="px-5 py-10 md:px-8 lg:px-12">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="eyebrow">Live construction bids</p>
            <h1 className="mt-4 text-6xl font-semibold tracking-[-.065em] md:text-8xl">
              Control every package.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-black/60">
              Keep the current solicitation, amendment impacts, trade
              follow-ups, and bid release in one accountable record.
            </p>
          </div>
          <MissionComposer teamId={team._id} />
        </div>
        <IntegrationReadiness teamId={team._id} />
        <div className="mt-12 grid gap-px border border-black/20 bg-black/20 md:grid-cols-2 xl:grid-cols-3">
          {missions?.map((mission: MissionSummary, index: number) => (
            <Link
              to={`missions/${mission._id}`}
              key={mission._id}
              className="group min-h-[250px] bg-[#f2eee5] p-6 transition hover:bg-[#e8e2d6]"
            >
              <div className="flex justify-between">
                <Badge
                  variant="outline"
                  className="border-black/25 bg-transparent"
                >
                  {mission.releaseState ?? mission.status}
                </Badge>
                <span className="font-mono text-xs text-black/60">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-16 text-2xl font-semibold leading-tight tracking-[-.035em]">
                {mission.opportunityTitle ?? mission.question}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-black/60">
                {mission.agency && <span>{mission.agency}</span>}
                {mission.solicitationNumber && (
                  <span>· {mission.solicitationNumber}</span>
                )}
              </div>
              <div className="mt-6 flex items-center justify-between text-xs text-black/60">
                <span>
                  {mission.reviewState === "change_detected"
                    ? "Package change needs review"
                    : mission.lastPackageCheckedAt
                      ? `Checked ${new Date(mission.lastPackageCheckedAt).toLocaleDateString()}`
                      : `${mission.sourceCount} package sources`}
                </span>
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
          {missions?.length === 0 && (
            <div className="col-span-full bg-[#f2eee5] p-12 text-center">
              <Radar className="mx-auto size-7 text-black/60" />
              <p className="mt-4 text-lg">No bid tracked yet.</p>
              <p className="mt-1 text-sm text-black/60">
                Start with the live public solicitation.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TeamReviewRouteDialog({ team }: { team: TeamSummary }) {
  const setReviewEmail = useMutation(api.teams.setReviewEmail);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(team.reviewEmail ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Review route">
          <MailCheck /> <span className="hidden lg:inline">Review route</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Set the package review route.
          </DialogTitle>
          <DialogDescription>
            Package alerts and internal briefs go only to this owner-approved
            address or a signed-in team member. Replies return to the same bid
            record.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setSaved(false);
            setError("");
            void setReviewEmail({ teamId: team._id, email })
              .then(() => setSaved(true))
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Review route could not be saved",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Label htmlFor="review-route-email">Review email</Label>
          <Input
            id="review-route-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12"
            required
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {saved && (
            <p
              role="status"
              className="mt-3 flex items-center gap-2 text-sm text-green-800"
            >
              <CheckCircle2 className="size-4" /> Review route secured.
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-full"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <MailCheck />
            )}
            Save review route
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateTeamDialog({
  onCreated,
}: {
  onCreated: (teamId: string) => void;
}) {
  const createTeam = useMutation(api.teams.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="New team">
          <Plus /> <span className="hidden lg:inline">New team</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Create another private workspace.
          </DialogTitle>
          <DialogDescription>
            Each team is an isolated boundary for collaborators, bid packages,
            contacts, and release records.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            void createTeam({ name })
              .then((teamId) => {
                setName("");
                setOpen(false);
                onCreated(teamId);
              })
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Team could not be created",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Label htmlFor="new-team-name">Team name</Label>
          <Input
            id="new-team-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={60}
            required
            className="mt-2 h-12"
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="mt-5 w-full rounded-full"
          >
            {pending ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Building2 />
            )}
            Create private team
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationReadiness({ teamId }: { teamId: Id<"teams"> }) {
  const readiness = useQuery(api.readiness.forTeam, { teamId });
  if (readiness === undefined) return null;

  const capabilities = [
    ["Source capture", readiness.firecrawl],
    ["Impact extraction", readiness.openai],
    ["Reply routing", readiness.agentMail],
  ] as const;

  return (
    <section className="mt-10 grid border border-black/20 lg:grid-cols-[1fr_auto]">
      <div className="p-5 md:p-6">
        <p className="eyebrow">Control room readiness</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">
          {readiness.researchReady
            ? "Package capture, change analysis, and follow-up routing are ready."
            : "New package capture stays locked until the required workspace capabilities are connected."}
        </p>
      </div>
      <div className="grid grid-cols-3 border-t border-black/20 lg:border-l lg:border-t-0">
        {capabilities.map(([label, configured]) => (
          <div
            key={label}
            className="flex min-w-0 flex-col justify-between border-r border-black/20 p-3 last:border-r-0 sm:p-4"
          >
            {configured ? (
              <CheckCircle2 className="size-4 text-[#4d6b31]" />
            ) : (
              <CircleAlert className="size-4 text-[#9c4d3f]" />
            )}
            <p className="mt-5 text-xs font-semibold">{label}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[.12em] text-black/60">
              {configured ? "Ready" : "Not connected"}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamInviteDialog({ teamId }: { teamId: Id<"teams"> }) {
  const inviteMember = useAction(api.teamActions.inviteMember);
  const members = useQuery(api.teams.listMembers, { teamId });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Invite collaborator">
          <UserPlus /> <span className="hidden sm:inline">Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Invite a collaborator.
          </DialogTitle>
          <DialogDescription>
            The invite uses a private, seven-day link. Only the matching
            signed-in email can accept it.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setSent(false);
            setError("");
            void inviteMember({ teamId, email })
              .then(() => {
                setSent(true);
                setEmail("");
              })
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Invitation could not be sent",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Label htmlFor="invite-email">Collaborator email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 h-12"
            required
          />
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {sent && (
            <p
              role="status"
              className="mt-3 flex items-center gap-2 text-sm text-green-800"
            >
              <CheckCircle2 className="size-4" /> Invitation sent securely.
            </p>
          )}
          <Button
            className="mt-5 w-full rounded-full"
            type="submit"
            disabled={pending}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Send />}{" "}
            Send private invite
          </Button>
        </form>
        <div className="border-t border-black/20 pt-4">
          <p className="eyebrow text-black/60">Current team</p>
          <ul className="mt-3 space-y-2 text-sm">
            {members?.map((member) => (
              <li
                key={member.userId}
                className="flex items-center justify-between"
              >
                <span>{member.email}</span>
                <Badge variant="outline" className="bg-transparent">
                  {member.role}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MissionComposer({ teamId }: { teamId: Id<"teams"> }) {
  const createMission = useMutation(api.missions.create);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [opportunityTitle, setOpportunityTitle] = useState("");
  const [solicitationUrl, setSolicitationUrl] = useState("");
  const [solicitationNumber, setSolicitationNumber] = useState("");
  const [agency, setAgency] = useState("");
  const [bidDueDate, setBidDueDate] = useState("");
  const [references, setReferences] = useState("");
  const [pageBudget, setPageBudget] = useState(20);
  const [depth, setDepth] = useState("1");
  const [error, setError] = useState("");
  const seedCount = new Set(
    [solicitationUrl, ...references.split(/\n|,/)]
      .map((seed) => seed.trim())
      .filter(Boolean),
  ).size;
  const minimumPageBudget = Math.max(1, Math.min(4, seedCount));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full">
          <Plus /> Track a bid
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto bg-[#f2eee5]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Add a live bid package.
          </DialogTitle>
          <DialogDescription>
            Establish the current public package as a controlled baseline. Each
            requirement stays tied to its exact source passage, and future
            changes reopen the release gate.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            void createMission({
              teamId,
              workflowKind: "prebid",
              opportunityTitle,
              solicitationUrl,
              solicitationNumber: solicitationNumber || undefined,
              agency: agency || undefined,
              bidDueAt: bidDueDate
                ? new Date(`${bidDueDate}T17:00:00`).getTime()
                : undefined,
              question: `Should we bid on ${opportunityTitle}? What requirements could make the bid nonresponsive, ineligible, or operationally unsafe?`,
              seeds: references
                .split(/\n|,/)
                .map((seed) => seed.trim())
                .filter(Boolean),
              pageBudget,
              depth: Number(depth),
            })
              .then((missionId) => {
                setOpen(false);
                void navigate(`missions/${missionId}`);
              })
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Mission could not be created",
                ),
              );
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="opportunity-title">Opportunity</Label>
              <Input
                id="opportunity-title"
                value={opportunityTitle}
                onChange={(event) => setOpportunityTitle(event.target.value)}
                className="mt-2 h-12"
                placeholder="Project or opportunity name"
                required
                minLength={3}
                maxLength={180}
              />
            </div>
            <div>
              <Label htmlFor="agency">Agency</Label>
              <Input
                id="agency"
                value={agency}
                onChange={(event) => setAgency(event.target.value)}
                className="mt-2 h-11"
                placeholder="Issuing agency"
                maxLength={180}
              />
            </div>
            <div>
              <Label htmlFor="solicitation-number">Solicitation number</Label>
              <Input
                id="solicitation-number"
                value={solicitationNumber}
                onChange={(event) => setSolicitationNumber(event.target.value)}
                className="mt-2 h-11 font-mono text-sm"
                placeholder="From the notice"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="bid-due-date">Bid deadline</Label>
              <div className="relative mt-2">
                <CalendarClock className="pointer-events-none absolute left-3 top-3 size-4 text-black/45" />
                <Input
                  id="bid-due-date"
                  type="date"
                  value={bidDueDate}
                  onChange={(event) => setBidDueDate(event.target.value)}
                  className="h-11 pl-10"
                />
              </div>
            </div>
          </div>
          <div>
            <Label htmlFor="solicitation-url">Public solicitation URL</Label>
            <div className="relative mt-2">
              <FileCheck2 className="pointer-events-none absolute left-3 top-3.5 size-4 text-black/45" />
              <Input
                id="solicitation-url"
                type="url"
                value={solicitationUrl}
                onChange={(event) => setSolicitationUrl(event.target.value)}
                className="h-12 pl-10 font-mono text-xs"
                placeholder="https://…"
                required
              />
            </div>
            <p className="mt-2 text-xs text-black/60">
              Use the authoritative notice or bid-package page. Signal Garden
              will capture linked public PDF, Word, and spreadsheet attachments
              inside the authorized package boundary.
            </p>
          </div>
          <div>
            <Label htmlFor="references">Additional authoritative URLs</Label>
            <Textarea
              id="references"
              value={references}
              onChange={(event) => {
                const value = event.target.value;
                setReferences(value);
                const nextSeedCount = new Set(
                  [solicitationUrl, ...value.split(/\n|,/)]
                    .map((seed) => seed.trim())
                    .filter(Boolean),
                ).size;
                setPageBudget((current) => Math.max(current, nextSeedCount));
              }}
              className="mt-2 min-h-20 font-mono text-xs"
              placeholder="Optional wage determination, agency instructions, or referenced clause URL"
            />
            <p className="mt-2 text-xs text-black/60">
              Up to three references. External discovery stays off; the system
              cannot quietly broaden the package boundary. Do not provide CUI,
              classified, export-controlled, or private bid material.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex justify-between">
                <Label>Package page limit</Label>
                <span className="font-mono text-sm">{pageBudget}</span>
              </div>
              <Slider
                value={[pageBudget]}
                min={minimumPageBudget}
                max={50}
                step={1}
                onValueChange={([value = 12]) => setPageBudget(value)}
                className="mt-5"
              />
            </div>
            <div>
              <Label>Capture depth</Label>
              <Select value={depth} onValueChange={setDepth}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 · supplied pages only</SelectItem>
                  <SelectItem value="1">1 · linked bid documents</SelectItem>
                  <SelectItem value="2">2 · full public package</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full rounded-full">
            Create bid control room <ArrowRight />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
