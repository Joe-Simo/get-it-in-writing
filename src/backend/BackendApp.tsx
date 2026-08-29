import { useState } from "react";
import {
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCopy,
  CheckCircle2,
  CircleAlert,
  Globe2,
  LoaderCircle,
  LogOut,
  MessageSquareText,
  NotebookPen,
  Plus,
  Radar,
  Send,
  ShieldCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { EvidenceGraph } from "@/components/observatory/EvidenceGraph";
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
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";

export default function BackendApp() {
  return (
    <>
      <Authenticated>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/missions/:missionId" element={<MissionWorkspace />} />
          <Route path="*" element={<Navigate to="." replace />} />
        </Routes>
      </Authenticated>
      <Unauthenticated>
        <SignInPage />
      </Unauthenticated>
    </>
  );
}

function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-screen bg-[#0a0d0b] text-[#f2eee5] lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r border-white/20 p-12 lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="font-semibold">
          ◉ Signal Garden
        </Link>
        <div>
          <p className="eyebrow text-[#c7ff4a]">Team access</p>
          <h1 className="mt-5 max-w-3xl text-7xl font-semibold leading-[.86] tracking-[-.065em]">
            Step inside the evidence field.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/55">
            Private missions, live collaborators, and review-ready briefs stay
            scoped to your team.
          </p>
        </div>
        <p className="text-xs text-white/60">
          Password authentication is handled inside the isolated Convex backend.
        </p>
      </section>
      <section className="flex items-center p-6 sm:p-12">
        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const form = new FormData(event.currentTarget);
            form.set("flow", flow);
            void signIn("password", form)
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Authentication failed",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Link
            to="/"
            className="mb-16 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back to the field
          </Link>
          <p className="eyebrow text-[#c7ff4a]">
            {flow === "signIn" ? "Welcome back" : "Create your account"}
          </p>
          <h2 className="mt-4 font-editorial text-5xl tracking-[-.04em]">
            {flow === "signIn"
              ? "Continue the inquiry."
              : "Open a new inquiry."}
          </h2>
          <div className="mt-10 space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 h-12 border-white/25 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  flow === "signIn" ? "current-password" : "new-password"
                }
                className="mt-2 h-12 border-white/25 bg-white/5 text-white"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[#ff8a78]">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="mt-8 h-12 w-full rounded-full bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {flow === "signIn" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="mt-5 w-full text-sm text-white/55 hover:text-white"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Dashboard() {
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
              First signal
            </Badge>
            <CardTitle className="font-editorial text-5xl font-normal tracking-[-.045em]">
              Name your research team.
            </CardTitle>
            <CardDescription>
              This creates a private boundary for missions, sources, and briefs.
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
            Join the research team.
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
  status: string;
  sourceCount: number;
  claimCount: number;
};

type TeamSummary = {
  _id: Id<"teams">;
  name: string;
  slug: string;
  role: "owner" | "member";
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
            <p className="eyebrow">Mission control</p>
            <h1 className="mt-4 text-6xl font-semibold tracking-[-.065em] md:text-8xl">
              Your gardens.
            </h1>
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
                  {mission.status}
                </Badge>
                <span className="font-mono text-xs text-black/60">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-16 text-2xl font-semibold leading-tight tracking-[-.035em]">
                {mission.question}
              </h2>
              <div className="mt-6 flex items-center justify-between text-xs text-black/60">
                <span>
                  {mission.sourceCount} sources · {mission.claimCount} claims
                </span>
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
          {missions?.length === 0 && (
            <div className="col-span-full bg-[#f2eee5] p-12 text-center">
              <Radar className="mx-auto size-7 text-black/60" />
              <p className="mt-4 text-lg">No mission framed yet.</p>
              <p className="mt-1 text-sm text-black/60">
                Start with a question and one trusted URL.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
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
            Open another private garden.
          </DialogTitle>
          <DialogDescription>
            Each team is an isolated boundary for collaborators, missions,
            evidence, and briefs.
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

  const providers = [
    ["OpenAI", readiness.openai],
    ["Firecrawl", readiness.firecrawl],
    ["AgentMail", readiness.agentMail],
  ] as const;

  return (
    <section className="mt-10 grid border border-black/20 lg:grid-cols-[1fr_auto]">
      <div className="p-5 md:p-6">
        <p className="eyebrow">Deployment readiness</p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">
          {readiness.researchReady
            ? "Research providers are connected for this deployment."
            : "Research launch stays locked until OpenAI and Firecrawl are configured on the isolated deployment."}
        </p>
      </div>
      <div className="grid grid-cols-3 border-t border-black/20 lg:border-l lg:border-t-0">
        {providers.map(([label, configured]) => (
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
            AgentMail sends a private, seven-day link. Only the matching
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
            Send with AgentMail
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
  const [question, setQuestion] = useState("");
  const [seeds, setSeeds] = useState("");
  const [pageBudget, setPageBudget] = useState(24);
  const [depth, setDepth] = useState("1");
  const [error, setError] = useState("");
  const seedCount = new Set(
    seeds
      .split(/\n|,/)
      .map((seed) => seed.trim())
      .filter(Boolean),
  ).size;
  const minimumPageBudget = Math.max(1, Math.min(4, seedCount));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-full">
          <Plus /> Frame a mission
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-[#f2eee5]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Set a boundary before the search.
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            void createMission({
              teamId,
              question,
              seeds: seeds
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
          <div>
            <Label htmlFor="question">Research question</Label>
            <Textarea
              id="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="mt-2 min-h-28"
              placeholder="What decision should this research help the team make?"
              required
              minLength={20}
              maxLength={500}
            />
          </div>
          <div>
            <Label htmlFor="seeds">Trusted seed URLs</Label>
            <Textarea
              id="seeds"
              value={seeds}
              onChange={(event) => {
                const value = event.target.value;
                const nextSeedCount = new Set(
                  value
                    .split(/\n|,/)
                    .map((seed) => seed.trim())
                    .filter(Boolean),
                ).size;
                setSeeds(value);
                setPageBudget((current) =>
                  Math.max(current, Math.min(4, nextSeedCount)),
                );
              }}
              className="mt-2 min-h-24 font-mono text-xs"
              placeholder={
                "https://docs.example.com\nhttps://research.example.org"
              }
              required
            />
            <p className="mt-2 text-xs text-black/60">
              One to four URLs. Every seed receives at least one page; the
              displayed budget is divided exactly across them. External links
              and subdomains remain off.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex justify-between">
                <Label>Page budget</Label>
                <span className="font-mono text-sm">{pageBudget}</span>
              </div>
              <Slider
                value={[pageBudget]}
                min={minimumPageBudget}
                max={50}
                step={1}
                onValueChange={([value = 24]) => setPageBudget(value)}
                className="mt-5"
              />
            </div>
            <div>
              <Label>Crawl depth</Label>
              <Select value={depth} onValueChange={setDepth}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 · seed pages only</SelectItem>
                  <SelectItem value="1">1 · linked child pages</SelectItem>
                  <SelectItem value="2">2 · broader exploration</SelectItem>
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
            Create bounded mission <ArrowRight />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MissionWorkspace() {
  const { missionId = "" } = useParams();
  const id = missionId as Id<"missions">;
  const data = useQuery(api.missions.getWorkspace, { missionId: id });
  const readiness = useQuery(api.readiness.forMission, { missionId: id });
  const startMission = useMutation(api.pipeline.start);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (data === undefined) return <WorkspaceLoader />;
  const seedNodes: EvidenceNode[] = data.seeds.map((seed, index) => ({
    id: seed._id,
    label: new URL(seed.url).hostname,
    detail: `Trusted starting point · ${seed.status}`,
    url: seed.url,
    kind: "source",
    status: seed.status === "complete" ? "supported" : "unresolved",
    confidence: 1,
    x: Math.cos(index * 2.4) * 0.74,
    y: Math.sin(index * 2.4) * 0.74,
  }));
  const sourceNodes: EvidenceNode[] = data.sources.map(
    (
      source: { _id: string; title: string; excerpt: string; url: string },
      index: number,
    ) => ({
      id: source._id,
      label: source.title,
      detail: source.excerpt,
      url: source.url,
      kind: "source",
      status: "supported",
      confidence: 0.98,
      x: Math.cos((index + seedNodes.length) * 2.4) * 0.62,
      y: Math.sin((index + seedNodes.length) * 2.4) * 0.62,
    }),
  );
  const claimNodes: EvidenceNode[] = data.claims.map(
    (claim: {
      _id: string;
      summary: string;
      text: string;
      status: EvidenceNode["status"];
      confidence: number;
      positionX: number;
      positionY: number;
    }) => ({
      id: claim._id,
      label: claim.summary,
      detail: claim.text,
      kind: "claim",
      status: claim.status,
      confidence: claim.confidence,
      x: claim.positionX,
      y: claim.positionY,
    }),
  );
  const nodes = [...seedNodes, ...sourceNodes, ...claimNodes];
  const edges: EvidenceEdge[] = data.links.map(
    (link: {
      _id: string;
      sourceId: string;
      claimId: string;
      support: EvidenceEdge["support"];
    }) => ({
      id: link._id,
      source: link.sourceId,
      target: link.claimId,
      support: link.support,
    }),
  );
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  return (
    <div className="min-h-screen bg-[#0a0d0b] text-[#f2eee5]">
      <header className="flex h-[70px] items-center justify-between border-b border-white/20 px-5 md:px-8">
        <Link
          to="/app"
          className="flex items-center gap-2 text-sm text-white/55 hover:text-white"
        >
          <ArrowLeft className="size-4" /> All missions
        </Link>
        <Badge
          variant="outline"
          className="border-white/25 bg-transparent text-white"
        >
          {data.mission.status}
        </Badge>
        <span className="text-xs text-white/60">Bounded mission</span>
      </header>
      <main className="grid min-h-[calc(100vh-70px)] lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="flex min-h-[720px] flex-col p-4 md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-[#c7ff4a]">Mission observatory</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-.045em] md:text-5xl">
                {data.mission.question}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(data.mission.status === "draft" ||
                data.mission.status === "failed") && (
                <Button
                  className="rounded-full bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
                  disabled={readiness?.researchReady !== true}
                  title={
                    readiness?.researchReady === true
                      ? undefined
                      : "Connect OpenAI and Firecrawl on this deployment before launch"
                  }
                  onClick={() => {
                    setError("");
                    void startMission({ missionId: id }).catch(
                      (reason: unknown) =>
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Mission could not start",
                        ),
                    );
                  }}
                >
                  {data.mission.status === "failed"
                    ? "Retry bounded crawl"
                    : "Launch bounded crawl"}
                  <ArrowRight />
                </Button>
              )}
              <GardenControls
                missionId={id}
                status={data.mission.status}
                garden={data.garden}
                onError={setError}
              />
              <MissionCancelDialog
                missionId={id}
                status={data.mission.status}
                onError={setError}
              />
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-[#ff6b57]/50 bg-[#ff6b57]/10 p-3 text-sm text-[#ff9b8b]"
            >
              {error}
            </p>
          )}
          {data.mission.status === "failed" && data.mission.error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 border border-[#ff6b57]/50 bg-[#ff6b57]/10 p-4 text-sm text-[#ffc0b6]"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Mission needs attention</p>
                <p className="mt-1 leading-relaxed">{data.mission.error}</p>
              </div>
            </div>
          )}
          {readiness !== undefined && !readiness.researchReady && (
            <div className="mb-4 flex items-center justify-between gap-4 border border-white/25 bg-white/[.03] px-4 py-3 text-sm">
              <span className="text-white/70">
                OpenAI and Firecrawl must be connected on this isolated
                deployment before launch.
              </span>
              <Badge
                variant="outline"
                className="shrink-0 border-white/30 bg-transparent text-white"
              >
                Launch locked
              </Badge>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <EvidenceGraph
              nodes={nodes}
              edges={edges}
              selectedId={selected?.id ?? null}
              onSelect={(node) => setSelectedId(node.id)}
            />
          </div>
          <div className="mt-4 grid gap-4 border-t border-white/20 pt-4 sm:grid-cols-4">
            {[
              ["Sources", data.mission.sourceCount],
              ["Claims", data.mission.claimCount],
              [
                "Processed",
                `${data.mission.pagesProcessed}/${data.mission.pageBudget}`,
              ],
              ["Depth", data.mission.depth],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="eyebrow text-white/60">{label}</p>
                <p className="mt-1 text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>
        <aside className="border-l border-white/20 bg-[#111512]">
          <ScrollArea className="h-[calc(100vh-70px)]">
            <div className="p-6">
              <p className="eyebrow text-[#c7ff4a]">Evidence ledger</p>
              {selected && (
                <article className="mt-6">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-white/25 bg-transparent text-white"
                    >
                      {selected.kind}
                    </Badge>
                    <Badge className="bg-[#c7ff4a] text-[#111612]">
                      {Math.round(selected.confidence * 100)}%
                    </Badge>
                  </div>
                  <h2 className="mt-5 text-3xl font-semibold leading-[1.02] tracking-[-.04em]">
                    {selected.label}
                  </h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/60">
                    {selected.detail}
                  </p>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-5 inline-flex items-center gap-2 text-sm text-[#c7ff4a]"
                    >
                      Open original source <ArrowRight className="size-3.5" />
                    </a>
                  )}
                </article>
              )}
              {selected?.kind === "claim" && (
                <ClaimNotes
                  missionId={id}
                  claimId={selected.id as Id<"claims">}
                  notes={data.notes.filter(
                    (note) => note.claimId === selected.id,
                  )}
                />
              )}
              <ReplyReview missionId={id} replies={data.replies} />
              <div className="mt-10 border-t border-white/20 pt-6">
                <p className="eyebrow text-white/60">Activity</p>
                <ol className="mt-4 space-y-4">
                  {data.events.map(
                    (event: {
                      _id: string;
                      label: string;
                      detail?: string;
                    }) => (
                      <li
                        key={event._id}
                        className="border-l border-[#c7ff4a]/35 pl-4"
                      >
                        <p className="text-sm">{event.label}</p>
                        {event.detail && (
                          <p className="mt-1 text-xs leading-relaxed text-white/60">
                            {event.detail}
                          </p>
                        )}
                      </li>
                    ),
                  )}
                </ol>
              </div>
              {data.mission.status !== "draft" && (
                <div className="mt-10">
                  <Progress
                    value={Math.min(
                      100,
                      (data.mission.pagesProcessed /
                        Math.max(1, data.mission.pageBudget)) *
                        100,
                    )}
                  />
                  <p className="mt-2 text-xs text-white/60">
                    Realtime mission progress
                  </p>
                </div>
              )}
              {data.brief && (
                <div className="mt-10 border border-white/20 p-5">
                  <p className="eyebrow text-[#c7ff4a]">Brief ready</p>
                  <h3 className="mt-3 text-xl font-semibold">
                    {data.brief.title}
                  </h3>
                  <p className="mt-2 text-sm text-white/55">
                    {data.brief.summary}
                  </p>
                  <BriefDeliveryDialog briefId={data.brief._id} />
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </main>
    </div>
  );
}

type MissionStatus =
  | "draft"
  | "crawling"
  | "extracting"
  | "synthesizing"
  | "ready"
  | "failed"
  | "cancelled";

function MissionCancelDialog({
  missionId,
  status,
  onError,
}: {
  missionId: Id<"missions">;
  status: MissionStatus;
  onError: (message: string) => void;
}) {
  const cancelMission = useMutation(api.missions.cancel);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const cancellable = [
    "draft",
    "crawling",
    "extracting",
    "synthesizing",
  ].includes(status);
  if (!cancellable) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
        >
          <XCircle /> Cancel mission
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5] text-[#111612]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Stop this mission?
          </DialogTitle>
          <DialogDescription>
            Signal Garden will cancel the durable workflow and reject late crawl
            callbacks. Evidence already collected stays in the private ledger.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep running
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              setPending(true);
              onError("");
              void cancelMission({ missionId })
                .then(() => setOpen(false))
                .catch((reason: unknown) =>
                  onError(
                    reason instanceof Error
                      ? reason.message
                      : "Mission could not be cancelled",
                  ),
                )
                .finally(() => setPending(false));
            }}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <XCircle />}
            Stop workflow
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GardenControls({
  missionId,
  status,
  garden,
  onError,
}: {
  missionId: Id<"missions">;
  status: MissionStatus;
  garden: { slug: string; publishedAt: number; revokedAt?: number } | null;
  onError: (message: string) => void;
}) {
  const publishGarden = useMutation(api.gardens.publish);
  const revokeGarden = useMutation(api.gardens.revoke);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const activeGarden = garden !== null && garden.revokedAt === undefined;
  const publicUrl = activeGarden
    ? `${window.location.origin}/garden/${garden.slug}`
    : null;

  if (status !== "ready" && !activeGarden) return null;

  if (!activeGarden) {
    return (
      <Button
        className="rounded-full bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
        disabled={pending}
        onClick={() => {
          setPending(true);
          onError("");
          void publishGarden({ missionId })
            .catch((reason: unknown) =>
              onError(
                reason instanceof Error
                  ? reason.message
                  : "Garden could not be published",
              ),
            )
            .finally(() => setPending(false));
        }}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Globe2 />}
        Publish read-only garden
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        asChild
        variant="outline"
        className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
      >
        <Link to={`/garden/${garden.slug}`} target="_blank">
          <Globe2 /> Open public garden
        </Link>
      </Button>
      <Button
        variant="outline"
        className="rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
        onClick={() => {
          if (publicUrl === null) return;
          void navigator.clipboard
            .writeText(publicUrl)
            .then(() => setCopied(true))
            .catch(() => onError("Public link could not be copied"));
        }}
      >
        <ClipboardCopy /> {copied ? "Copied" : "Copy link"}
      </Button>
      <Dialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="rounded-full text-white/70 hover:bg-white/10 hover:text-white"
          >
            Revoke
          </Button>
        </DialogTrigger>
        <DialogContent className="bg-[#f2eee5] text-[#111612]">
          <DialogHeader>
            <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
              Make this garden private?
            </DialogTitle>
            <DialogDescription>
              The current public URL will stop resolving immediately. Private
              evidence, notes, and replies are never included in the public
              projection.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setRevokeOpen(false)}>
              Keep public
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setPending(true);
                onError("");
                void revokeGarden({ missionId })
                  .then(() => setRevokeOpen(false))
                  .catch((reason: unknown) =>
                    onError(
                      reason instanceof Error
                        ? reason.message
                        : "Garden could not be revoked",
                    ),
                  )
                  .finally(() => setPending(false));
              }}
            >
              {pending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ShieldCheck />
              )}
              Revoke public link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClaimNotes({
  missionId,
  claimId,
  notes,
}: {
  missionId: Id<"missions">;
  claimId: Id<"claims">;
  notes: Array<{
    _id: Id<"claimNotes">;
    body: string;
    createdAt: number;
  }>;
}) {
  const addNote = useMutation(api.review.addClaimNote);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <section className="mt-8 border-t border-white/20 pt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-white/60">Team notes</p>
        <Badge
          variant="outline"
          className="border-white/25 bg-transparent text-white"
        >
          {notes.length}
        </Badge>
      </div>
      {notes.length > 0 && (
        <ol className="mt-4 space-y-3">
          {notes.map((note) => (
            <li
              key={note._id}
              className="border border-white/20 bg-white/[.03] p-3"
            >
              <p className="text-sm leading-relaxed text-white/70">
                {note.body}
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-[.15em] text-white/60">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(note.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
      <form
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPending(true);
          setError("");
          void addNote({ missionId, claimId, body })
            .then(() => setBody(""))
            .catch((reason: unknown) =>
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Note could not be added",
              ),
            )
            .finally(() => setPending(false));
        }}
      >
        <Label htmlFor={`claim-note-${claimId}`} className="sr-only">
          Add a private note to this claim
        </Label>
        <Textarea
          id={`claim-note-${claimId}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a private team note…"
          minLength={2}
          maxLength={1000}
          required
          className="min-h-20 border-white/25 bg-white/[.04] text-white placeholder:text-white/60"
        />
        {error && (
          <p role="alert" className="mt-2 text-xs text-[#ff9b8b]">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          className="mt-3 w-full border-white/25 bg-transparent text-white hover:bg-white/10"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <NotebookPen />
          )}
          Save private note
        </Button>
      </form>
    </section>
  );
}

type ReviewReply = {
  _id: Id<"inboundReplies">;
  senderEmail: string;
  intent: "comment" | "question" | "refresh_request" | "unrecognized";
  body: string;
  status: "pending" | "reviewed";
  receivedAt: number;
};

function ReplyReview({
  missionId,
  replies,
}: {
  missionId: Id<"missions">;
  replies: ReviewReply[];
}) {
  const markReviewed = useMutation(api.review.markReplyReviewed);
  const [pendingId, setPendingId] = useState<Id<"inboundReplies"> | null>(null);
  const [error, setError] = useState("");
  const pendingCount = replies.filter(
    (reply) => reply.status === "pending",
  ).length;

  return (
    <section className="mt-10 border-t border-white/20 pt-6">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-white/60">Verified replies</p>
        {pendingCount > 0 && (
          <Badge className="bg-[#ffca5c] text-[#111612]">
            {pendingCount} pending
          </Badge>
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/50">
        AgentMail replies require human review. Refresh requests never launch a
        crawl automatically.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-xs text-[#ff9b8b]">
          {error}
        </p>
      )}
      {replies.length === 0 ? (
        <div className="mt-4 border border-dashed border-white/25 p-4 text-sm text-white/50">
          <MessageSquareText className="mb-3 size-5" /> No verified replies yet.
        </div>
      ) : (
        <ol className="mt-4 space-y-3">
          {replies.map((reply) => (
            <li key={reply._id} className="border border-white/20 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/25 bg-transparent text-white"
                >
                  {reply.intent.replace("_", " ")}
                </Badge>
                <Badge
                  className={
                    reply.status === "pending"
                      ? "bg-[#ffca5c] text-[#111612]"
                      : "bg-[#c7ff4a] text-[#111612]"
                  }
                >
                  {reply.status}
                </Badge>
              </div>
              <p className="mt-3 text-xs text-white/60">{reply.senderEmail}</p>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                {reply.body}
              </p>
              {reply.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pendingId === reply._id}
                  className="mt-4 w-full border-white/25 bg-transparent text-white hover:bg-white/10"
                  onClick={() => {
                    setPendingId(reply._id);
                    setError("");
                    void markReviewed({ missionId, replyId: reply._id })
                      .catch((reason: unknown) =>
                        setError(
                          reason instanceof Error
                            ? reason.message
                            : "Reply could not be reviewed",
                        ),
                      )
                      .finally(() => setPendingId(null));
                  }}
                >
                  {pendingId === reply._id ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  Mark reviewed
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BriefDeliveryDialog({ briefId }: { briefId: Id<"briefs"> }) {
  const sendBrief = useAction(api.emailActions.sendBrief);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="mt-5 w-full border-white/25 bg-transparent text-white hover:bg-white/10"
        >
          <Send /> Deliver with AgentMail
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5] text-[#111612]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Deliver the sourced brief.
          </DialogTitle>
          <DialogDescription>
            For privacy, delivery is limited to current team members. Replies
            return as verified review items.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setSent(false);
            setError("");
            void sendBrief({ briefId, recipientEmail: email })
              .then(() => {
                setSent(true);
                setEmail("");
              })
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Brief could not be delivered",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Label htmlFor="brief-email">Team member email</Label>
          <Input
            id="brief-email"
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
              <CheckCircle2 className="size-4" /> Brief sent and reply tracking
              enabled.
            </p>
          )}
          <Button
            type="submit"
            className="mt-5 w-full rounded-full"
            disabled={pending}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : <Send />}{" "}
            Send private brief
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-[#f2eee5]">
      <LoaderCircle className="size-7 animate-spin text-[#c7ff4a]" />
      <span className="sr-only">Loading workspace</span>
    </div>
  );
}
