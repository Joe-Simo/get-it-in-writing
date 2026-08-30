import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  ClipboardCopy,
  ExternalLink,
  FileCheck2,
  Globe2,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  NotebookPen,
  Send,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";
import { EvidenceGraph } from "@/components/observatory/EvidenceGraph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

export default function MissionWorkspacePage() {
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
          <ArrowLeft className="size-4" /> All decisions
        </Link>
        <Badge
          variant="outline"
          className="border-white/25 bg-transparent text-white"
        >
          {data.mission.status}
        </Badge>
        <span className="text-xs text-white/60">Pre-bid readiness</span>
      </header>
      <main className="grid min-h-[calc(100vh-70px)] lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="flex min-h-[720px] flex-col p-4 md:p-6">
          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-[#c7ff4a]">Opportunity readiness</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight tracking-[-.045em] md:text-5xl">
                {data.mission.opportunityTitle ?? data.mission.question}
              </h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/55">
                {data.mission.agency && <span>{data.mission.agency}</span>}
                {data.mission.solicitationNumber && (
                  <span className="font-mono">
                    {data.mission.solicitationNumber}
                  </span>
                )}
                {data.mission.solicitationUrl && (
                  <a
                    href={data.mission.solicitationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#c7ff4a] hover:underline"
                  >
                    Open solicitation <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
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
                            : "Research could not start",
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
                <p className="font-semibold">Research needs attention</p>
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
          <OpportunityReadiness
            missionId={id}
            mission={data.mission}
            requirements={data.requirements}
            onError={setError}
          />
          <div className="mb-3 mt-8 flex items-end justify-between gap-4 border-t border-white/20 pt-6">
            <div>
              <p className="eyebrow text-[#c7ff4a]">Source proof</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">
                Evidence map
              </h2>
            </div>
            <span className="max-w-xs text-right text-xs leading-relaxed text-white/50">
              Every extracted requirement stays linked to the source passage
              that produced it.
            </span>
          </div>
          <div className="min-h-[520px] flex-1">
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
              <p className="eyebrow text-[#c7ff4a]">Source ledger</p>
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
                    Realtime research progress
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
                  <BriefDeliveryDialog
                    briefId={data.brief._id}
                    reviewEmail={data.reviewEmail}
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </aside>
      </main>
    </div>
  );
}

type RequirementStatus = "open" | "satisfied" | "missing" | "not_applicable";
type RequirementCriticality = "disqualifier" | "high" | "standard";
type RequirementCategory =
  | "submission"
  | "bonding"
  | "insurance"
  | "eligibility"
  | "labor"
  | "safety"
  | "schedule"
  | "technical"
  | "pricing"
  | "other";

type PrebidRequirement = {
  _id: Id<"requirements">;
  sourceId: Id<"sources">;
  claimId: Id<"claims">;
  text: string;
  category: RequirementCategory;
  criticality: RequirementCriticality;
  status: RequirementStatus;
  requiredWithBid: boolean;
  sourceQuote: string;
  dueDateText?: string;
  ownerLabel?: string;
  note?: string;
  sourceTitle: string;
  sourceUrl: string;
};

type PrebidMission = {
  status: MissionStatus;
  workflowKind?: "research" | "prebid";
  bidDueAt?: number;
  decision?: "undecided" | "bid" | "no_bid";
  decisionRationale?: string;
};

function OpportunityReadiness({
  missionId,
  mission,
  requirements,
  onError,
}: {
  missionId: Id<"missions">;
  mission: PrebidMission;
  requirements: PrebidRequirement[];
  onError: (message: string) => void;
}) {
  const setDecision = useMutation(api.requirements.setDecision);
  const [currentTime] = useState(() => Date.now());
  const [rationale, setRationale] = useState(mission.decisionRationale ?? "");
  const [decisionPending, setDecisionPending] = useState(false);
  const resolved = requirements.filter(
    (requirement) =>
      requirement.status === "satisfied" ||
      requirement.status === "not_applicable",
  ).length;
  const missing = requirements.filter(
    (requirement) => requirement.status === "missing",
  ).length;
  const openDisqualifiers = requirements.filter(
    (requirement) =>
      requirement.criticality === "disqualifier" &&
      requirement.status !== "satisfied" &&
      requirement.status !== "not_applicable",
  ).length;
  const readinessPercent =
    requirements.length === 0
      ? 0
      : Math.round((resolved / requirements.length) * 100);
  const daysRemaining =
    mission.bidDueAt === undefined
      ? null
      : Math.ceil((mission.bidDueAt - currentTime) / 86_400_000);
  const posture = requirements.some(
    (requirement) =>
      requirement.criticality === "disqualifier" &&
      requirement.status === "missing",
  )
    ? "No-bid risk"
    : openDisqualifiers > 0
      ? "Hold before pricing"
      : requirements.length > 0 && resolved === requirements.length
        ? "Ready for human decision"
        : "Needs solicitation evidence";

  const recordDecision = (decision: "undecided" | "bid" | "no_bid") => {
    setDecisionPending(true);
    onError("");
    void setDecision({
      missionId,
      decision,
      rationale: rationale || undefined,
    })
      .catch((reason: unknown) =>
        onError(
          reason instanceof Error
            ? reason.message
            : "The decision could not be recorded",
        ),
      )
      .finally(() => setDecisionPending(false));
  };

  return (
    <section className="border border-white/20 bg-white/[.025]">
      <div className="grid border-b border-white/20 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [posture, "current posture"],
          [String(readinessPercent) + "%", "requirements resolved"],
          [String(openDisqualifiers), "open disqualifiers"],
          [
            daysRemaining === null
              ? "Not set"
              : daysRemaining < 0
                ? `${Math.abs(daysRemaining)}d late`
                : `${daysRemaining}d`,
            "until bid deadline",
          ],
        ].map(([value, label]) => (
          <div
            key={label}
            className="border-b border-r border-white/20 p-4 last:border-r-0 sm:p-5"
          >
            <p className="text-2xl font-semibold tracking-[-.04em]">{value}</p>
            <p className="eyebrow mt-2 text-white/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <div className="flex items-center gap-2">
                <ListChecks className="size-5 text-[#c7ff4a]" />
                <p className="eyebrow text-[#c7ff4a]">Compliance matrix</p>
              </div>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">
                What must be true before the bid goes out.
              </h2>
            </div>
            <Badge
              variant="outline"
              className="w-fit border-white/25 bg-transparent text-white"
            >
              {requirements.length} sourced requirements
            </Badge>
          </div>

          {requirements.length === 0 ? (
            <div className="mt-6 border border-dashed border-white/25 p-6">
              <FileCheck2 className="size-6 text-[#c7ff4a]" />
              <p className="mt-4 font-semibold">
                {mission.workflowKind !== "prebid"
                  ? "This analysis predates solicitation intake."
                  : mission.status === "draft"
                    ? "Launch the bounded crawl to extract bid requirements."
                    : ["crawling", "extracting", "synthesizing"].includes(
                          mission.status,
                        )
                      ? "The compliance matrix is being built from the live source set."
                      : "No explicit bid requirements were found in the authorized source set."}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                A real pre-bid decision needs the solicitation or bid package
                itself. Generic regulations can explain the rules, but they
                cannot supply this opportunity&apos;s forms, dates, bonds, or
                submission instructions.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {[...requirements]
                .sort((left, right) => {
                  const severity = { disqualifier: 0, high: 1, standard: 2 };
                  return (
                    severity[left.criticality] - severity[right.criticality]
                  );
                })
                .map((requirement) => (
                  <RequirementRow
                    key={requirement._id}
                    requirement={requirement}
                    onError={onError}
                  />
                ))}
            </div>
          )}
        </div>

        <aside className="border-t border-white/20 p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center gap-2">
            <UserRoundCheck className="size-5 text-[#c7ff4a]" />
            <p className="eyebrow text-[#c7ff4a]">Human decision</p>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/58">
            The matrix exposes risk. A team member still owns the final pursuit
            decision and its rationale.
          </p>
          <Label
            htmlFor="decision-rationale"
            className="mt-6 block text-white/75"
          >
            Decision rationale
          </Label>
          <Textarea
            id="decision-rationale"
            value={rationale}
            onChange={(event) => setRationale(event.target.value)}
            placeholder="Why this opportunity is or is not worth estimator time"
            className="mt-2 min-h-28 border-white/25 bg-black/20 text-white placeholder:text-white/35"
            maxLength={2_000}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant={mission.decision === "bid" ? "default" : "outline"}
              className={
                mission.decision === "bid"
                  ? "bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
                  : "border-white/25 bg-transparent text-white hover:bg-white/10"
              }
              disabled={decisionPending}
              onClick={() => recordDecision("bid")}
            >
              Bid
            </Button>
            <Button
              variant={
                mission.decision === "no_bid" ? "destructive" : "outline"
              }
              className={
                mission.decision === "no_bid"
                  ? "bg-[#ff6b57] text-[#111612] hover:bg-[#ff8575]"
                  : "border-white/25 bg-transparent text-white hover:bg-white/10"
              }
              disabled={decisionPending}
              onClick={() => recordDecision("no_bid")}
            >
              No bid
            </Button>
          </div>
          {mission.decision !== undefined &&
            mission.decision !== "undecided" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-white/55 hover:bg-white/10 hover:text-white"
                disabled={decisionPending}
                onClick={() => recordDecision("undecided")}
              >
                Reopen decision
              </Button>
            )}
          <div className="mt-6 border-t border-white/20 pt-4">
            <p className="eyebrow text-white/45">Current record</p>
            <p className="mt-2 text-lg font-semibold capitalize">
              {(mission.decision ?? "undecided").replace("_", " ")}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {missing} missing · {resolved} resolved · {requirements.length}{" "}
              total
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function RequirementRow({
  requirement,
  onError,
}: {
  requirement: PrebidRequirement;
  onError: (message: string) => void;
}) {
  const updateRequirement = useMutation(api.requirements.update);
  const [ownerLabel, setOwnerLabel] = useState(requirement.ownerLabel ?? "");
  const [dueDateText, setDueDateText] = useState(requirement.dueDateText ?? "");
  const [note, setNote] = useState(requirement.note ?? "");
  const [pending, setPending] = useState(false);

  const save = (changes: {
    status?: RequirementStatus;
    ownerLabel?: string;
    dueDateText?: string;
    note?: string;
  }) => {
    setPending(true);
    onError("");
    void updateRequirement({ requirementId: requirement._id, ...changes })
      .catch((reason: unknown) =>
        onError(
          reason instanceof Error
            ? reason.message
            : "The requirement could not be updated",
        ),
      )
      .finally(() => setPending(false));
  };

  return (
    <article className="border border-white/20 bg-black/15 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                requirement.criticality === "disqualifier"
                  ? "bg-[#ff6b57] text-[#111612]"
                  : requirement.criticality === "high"
                    ? "bg-[#f1be55] text-[#111612]"
                    : "bg-white/15 text-white"
              }
            >
              {requirement.criticality}
            </Badge>
            <Badge
              variant="outline"
              className="border-white/25 bg-transparent text-white/75"
            >
              {requirement.category}
            </Badge>
            {requirement.requiredWithBid && (
              <Badge
                variant="outline"
                className="border-[#c7ff4a]/45 bg-transparent text-[#c7ff4a]"
              >
                required with bid
              </Badge>
            )}
          </div>
          <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-.02em]">
            {requirement.text}
          </h3>
          <blockquote className="mt-3 border-l border-white/25 pl-3 text-xs leading-relaxed text-white/48">
            {requirement.sourceQuote}
          </blockquote>
          <a
            href={requirement.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#c7ff4a] hover:underline"
          >
            {requirement.sourceTitle} <ExternalLink className="size-3" />
          </a>
        </div>
        <Select
          value={requirement.status}
          disabled={pending}
          onValueChange={(status) =>
            save({ status: status as RequirementStatus })
          }
        >
          <SelectTrigger
            aria-label={`Status for ${requirement.text}`}
            className="w-full border-white/25 bg-black/20 text-white lg:w-[150px]"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="satisfied">Satisfied</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
            <SelectItem value="not_applicable">Not applicable</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 grid gap-3 border-t border-white/15 pt-4 md:grid-cols-[1fr_1fr_1.5fr_auto]">
        <div>
          <Label
            htmlFor={`owner-${requirement._id}`}
            className="text-xs text-white/55"
          >
            Owner
          </Label>
          <Input
            id={`owner-${requirement._id}`}
            value={ownerLabel}
            onChange={(event) => setOwnerLabel(event.target.value)}
            placeholder="Unassigned"
            className="mt-1 border-white/20 bg-black/20 text-white placeholder:text-white/30"
            maxLength={80}
          />
        </div>
        <div>
          <Label
            htmlFor={`due-${requirement._id}`}
            className="text-xs text-white/55"
          >
            Due / timing
          </Label>
          <Input
            id={`due-${requirement._id}`}
            value={dueDateText}
            onChange={(event) => setDueDateText(event.target.value)}
            placeholder="Not stated"
            className="mt-1 border-white/20 bg-black/20 text-white placeholder:text-white/30"
            maxLength={120}
          />
        </div>
        <div>
          <Label
            htmlFor={`note-${requirement._id}`}
            className="text-xs text-white/55"
          >
            Evidence / note
          </Label>
          <Input
            id={`note-${requirement._id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Where the proof lives or what is missing"
            className="mt-1 border-white/20 bg-black/20 text-white placeholder:text-white/30"
            maxLength={1_000}
          />
        </div>
        <Button
          variant="outline"
          className="self-end border-white/25 bg-transparent text-white hover:bg-white/10"
          disabled={pending}
          onClick={() => save({ ownerLabel, dueDateText, note })}
        >
          {pending ? <LoaderCircle className="animate-spin" /> : "Save"}
        </Button>
      </div>
    </article>
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
          <XCircle /> Stop research
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#f2eee5] text-[#111612]">
        <DialogHeader>
          <DialogTitle className="font-editorial text-4xl font-normal tracking-[-.04em]">
            Stop this research?
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
                  : "Decision brief could not be published",
              ),
            )
            .finally(() => setPending(false));
        }}
      >
        {pending ? <LoaderCircle className="animate-spin" /> : <Globe2 />}
        Publish decision brief
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
          <Globe2 /> Open public brief
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
              Make this brief private?
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
                        : "Decision brief could not be revoked",
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

function BriefDeliveryDialog({
  briefId,
  reviewEmail,
}: {
  briefId: Id<"briefs">;
  reviewEmail: string | null;
}) {
  const sendBrief = useAction(api.emailActions.sendBrief);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(reviewEmail ?? "");
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
            For privacy, delivery is limited to current team members or the
            owner-approved review route. Replies return as verified review
            items.
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
          <Label htmlFor="brief-email">Approved review email</Label>
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
