import { useState } from "react";
import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import Markdown from "react-markdown";
import {
  ArrowDown,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileDiff,
  LockKeyhole,
  LoaderCircle,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { EvidenceGraph } from "@/components/observatory/EvidenceGraph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";

type PublicBrief = {
  title: string;
  summary: string;
  body: string;
};

type PublicProcess = {
  pagesProcessed: number;
  sourceCount: number;
  claimCount: number;
  deliveryCount: number;
  verifiedReplyCount: number;
  events: Array<{
    type:
      | "mission"
      | "crawl"
      | "source"
      | "claim"
      | "brief"
      | "email"
      | "watch"
      | "release"
      | "impact";
    label: string;
  }>;
};

type PublicOpportunity = {
  title: string;
  solicitationUrl: string;
  solicitationNumber?: string;
  agency?: string;
  bidDueAt?: number;
  decision?: "undecided" | "bid" | "no_bid";
};

type PublicRequirement = {
  _id: string;
  text: string;
  category:
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
  criticality: "disqualifier" | "high" | "standard";
  status: "open" | "satisfied" | "missing" | "not_applicable";
  requiredWithBid: boolean;
  dueDateText?: string;
  sourceTitle: string;
  sourceUrl: string;
};

type PublicConstructionCheck = {
  ruleKey: string;
  label: string;
  category: string;
  severity: "blocking" | "high" | "standard";
  explanation: string;
  status: "verified" | "unverified" | "resolved" | "not_applicable";
  sourceVerified: boolean;
};

type PublicControl = {
  state: "blocked" | "ready" | "approved";
  packageVersion: number;
  lastCapturedAt?: number;
  impactCount: number;
  blockers: Array<{
    kind: "package" | "requirement" | "construction" | "change";
    title: string;
  }>;
};

export default function PublicGardenPage() {
  const { slug = "" } = useParams();
  const garden = useQuery(api.gardens.getPublic, { slug });
  if (garden === undefined) return <GardenLoader />;
  if (garden === null) return <UnavailableGarden />;

  const sourceNodes: EvidenceNode[] = garden.sources.map((source, index) => ({
    id: source._id,
    label: source.title,
    detail: source.excerpt,
    kind: "source",
    status: "supported",
    confidence: 0.98,
    url: source.url,
    x: Math.cos(index * 2.4) * 0.72,
    y: Math.sin(index * 2.4) * 0.72,
  }));
  const claimNodes: EvidenceNode[] = garden.claims.map((claim) => ({
    id: claim._id,
    label: claim.summary,
    detail: claim.text,
    kind: "claim",
    status: claim.status,
    confidence: claim.confidence,
    x: claim.positionX,
    y: claim.positionY,
  }));
  const edges: EvidenceEdge[] = garden.links.map((link) => ({
    id: link._id,
    source: link.sourceId,
    target: link.claimId,
    support: link.support,
  }));

  return (
    <GardenView
      question={garden.question}
      opportunity={garden.opportunity}
      requirements={garden.requirements}
      constructionChecks={garden.constructionChecks}
      control={garden.control}
      nodes={[...sourceNodes, ...claimNodes]}
      edges={edges}
      brief={garden.brief}
      process={garden.process}
    />
  );
}

function GardenView({
  question,
  opportunity,
  requirements,
  constructionChecks,
  control,
  nodes,
  edges,
  brief,
  process,
}: {
  question: string;
  opportunity: PublicOpportunity | null;
  requirements: PublicRequirement[];
  constructionChecks: PublicConstructionCheck[];
  control: PublicControl;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
  brief: PublicBrief | null;
  process: PublicProcess;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    nodes[0]?.id ?? null,
  );
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const displayBrief = brief
    ? {
        ...brief,
        summary: replaceClaimIds(brief.summary, nodes),
        body: replaceClaimIds(brief.body, nodes),
      }
    : null;

  return (
    <main className="min-h-screen bg-[#0a0d0b] text-[#f2eee5]">
      <a href="#decision-brief" className="skip-link">
        Skip to decision brief
      </a>
      <div className="mx-auto max-w-[1500px] px-4 pb-16 pt-4 md:px-8 md:pt-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="size-4" /> Signal Garden
          </Link>
          <Badge
            variant="outline"
            className="border-white/30 bg-transparent text-white"
          >
            Public read-only bid record
          </Badge>
        </header>

        <section className="mt-12 grid gap-8 lg:grid-cols-[.78fr_1.22fr] lg:gap-12">
          <div className="flex flex-col">
            <p className="eyebrow text-[#c7ff4a]">
              {opportunity
                ? "Live bid control record"
                : "Decision under review"}
            </p>
            <h1 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.055em] md:text-7xl">
              {opportunity?.title ?? question}
            </h1>
            {opportunity && (
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/55">
                {opportunity.agency && <span>{opportunity.agency}</span>}
                {opportunity.solicitationNumber && (
                  <span className="font-mono">
                    {opportunity.solicitationNumber}
                  </span>
                )}
                <a
                  href={opportunity.solicitationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[#c7ff4a] hover:underline"
                >
                  Original solicitation <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {displayBrief && (
              <div className="mt-8 border-l border-[#c7ff4a] pl-5">
                <p className="eyebrow text-white/60">Recommendation</p>
                <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-.03em]">
                  {displayBrief.title}
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/65">
                  {displayBrief.summary}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-5 rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
                >
                  <a href="#decision-brief">
                    Read the complete brief <ArrowDown className="size-4" />
                  </a>
                </Button>
              </div>
            )}
            <dl className="mt-10 grid grid-cols-3 border-l border-t border-white/20 bg-[#0a0d0b]">
              {[
                [process.pagesProcessed, "pages processed"],
                [process.sourceCount, "trusted sources"],
                [process.claimCount, "linked claims"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="border-b border-r border-white/20 bg-[#0a0d0b] p-4"
                >
                  <dd className="text-3xl font-semibold tracking-[-.05em]">
                    {value}
                  </dd>
                  <dt className="mt-2 text-[10px] font-semibold uppercase tracking-[.15em] text-white/60">
                    {label}
                  </dt>
                </div>
              ))}
            </dl>
            <p className="mt-6 max-w-xl text-xs leading-relaxed text-white/52">
              Public output includes only the decision brief, claims, sources,
              and privacy-safe process proof. Team identities, email addresses,
              message contents, private notes, and webhook records are excluded
              server-side.
            </p>
          </div>

          <div className="flex min-h-[620px] flex-col">
            <div className="min-h-0 flex-1">
              <EvidenceGraph
                nodes={nodes}
                edges={edges}
                selectedId={selected?.id ?? null}
                onSelect={(node) => setSelectedId(node.id)}
              />
            </div>
            {selected && (
              <article className="mt-4 grid gap-3 border-t border-white/20 pt-4 sm:grid-cols-[130px_1fr]">
                <p className="eyebrow text-white/60">Selected evidence</p>
                <div>
                  <h2 className="text-xl font-semibold tracking-[-.02em]">
                    {selected.label}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">
                    {selected.detail}
                  </p>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm text-[#c7ff4a]"
                    >
                      Inspect source <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </div>
              </article>
            )}
          </div>
        </section>
      </div>

      <PublicReleaseGate control={control} />

      {requirements.length > 0 && (
        <PublicComplianceMatrix
          opportunity={opportunity}
          requirements={requirements}
        />
      )}
      {constructionChecks.length > 0 && (
        <PublicConstructionRulepack checks={constructionChecks} />
      )}
      {displayBrief && (
        <DecisionBrief brief={displayBrief} nodes={nodes} edges={edges} />
      )}
      <ProcessProof process={process} />
    </main>
  );
}

function PublicReleaseGate({ control }: { control: PublicControl }) {
  return (
    <section className="border-y border-white/20 px-5 py-14 md:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1400px] border-l border-t border-white/20 lg:grid-cols-[.72fr_1.28fr]">
        <div className="border-b border-r border-white/20 p-6 md:p-8">
          <div className="flex items-center gap-2">
            <LockKeyhole className="size-5 text-[#c7ff4a]" />
            <p className="eyebrow text-[#c7ff4a]">Bid release gate</p>
          </div>
          <p className="mt-6 text-5xl font-semibold tracking-[-.055em] capitalize">
            {control.state}
          </p>
          <div className="mt-8 grid grid-cols-2 border-l border-t border-white/20">
            {[
              [control.packageVersion, "package version"],
              [control.impactCount, "change impacts"],
            ].map(([value, label]) => (
              <div
                key={label}
                className="border-b border-r border-white/20 p-4"
              >
                <p className="text-3xl font-semibold">{value}</p>
                <p className="eyebrow mt-2 text-white/45">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-b border-r border-white/20 p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow text-white/45">What holds release</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em]">
                Current, source-backed blockers
              </h2>
            </div>
            <FileDiff className="size-5 text-[#c7ff4a]" />
          </div>
          <ol className="mt-6 border-t border-white/20">
            {control.blockers.slice(0, 8).map((blocker, index) => (
              <li
                key={`${blocker.kind}-${blocker.title}`}
                className="grid grid-cols-[34px_1fr_auto] gap-3 border-b border-white/20 py-4"
              >
                <span className="font-mono text-xs text-[#c7ff4a]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm font-semibold">{blocker.title}</span>
                <span className="text-[9px] uppercase tracking-[.14em] text-white/45">
                  {blocker.kind}
                </span>
              </li>
            ))}
            {control.blockers.length === 0 && (
              <li className="flex items-center gap-2 border-b border-white/20 py-4 text-sm text-[#c7ff4a]">
                <CheckCircle2 className="size-4" /> No material release holds
                remain.
              </li>
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PublicConstructionRulepack({
  checks,
}: {
  checks: PublicConstructionCheck[];
}) {
  const unverifiedBlocking = checks.filter(
    (check) => check.severity === "blocking" && check.status === "unverified",
  ).length;
  return (
    <section className="border-t border-black/20 bg-[#e8e3d8] px-5 py-20 text-[#111612] md:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr]">
          <div>
            <p className="eyebrow text-[#4d6b31]">
              Federal construction rulepack
            </p>
            <h2 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.055em] md:text-7xl">
              What the package proves—and what it still cannot.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-black/62">
              Verified checks match the authorized source set. Unverified checks
              are explicit gaps for the team to resolve; they are not claims
              that the solicitation requires an absent item.
            </p>
            <div className="mt-8 border-l-2 border-[#9c4d3f] pl-4">
              <p className="text-4xl font-semibold tracking-[-.05em]">
                {unverifiedBlocking}
              </p>
              <p className="eyebrow mt-2 text-black/65">
                blocking checks still unverified
              </p>
            </div>
          </div>
          <ol className="grid border-l border-t border-black/20 sm:grid-cols-2">
            {checks.map((check, index) => (
              <li
                key={check.ruleKey}
                className="border-b border-r border-black/20 p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[#4d6b31]">
                    R{String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[.13em] ${
                      check.status === "verified" || check.status === "resolved"
                        ? "bg-[#c7ff4a]"
                        : check.status === "not_applicable"
                          ? "bg-black/10"
                          : check.severity === "blocking"
                            ? "bg-[#ff6b57]"
                            : "bg-[#e9b94f]"
                    }`}
                  >
                    {check.status.replace("_", " ")}
                  </span>
                </div>
                <h3 className="mt-10 text-lg font-semibold tracking-[-.025em]">
                  {check.label}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-black/58">
                  {check.explanation}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PublicComplianceMatrix({
  opportunity,
  requirements,
}: {
  opportunity: PublicOpportunity | null;
  requirements: PublicRequirement[];
}) {
  const resolved = requirements.filter(
    (requirement) =>
      requirement.status === "satisfied" ||
      requirement.status === "not_applicable",
  ).length;
  const requiredWithBid = requirements.filter(
    (requirement) => requirement.requiredWithBid,
  ).length;
  const openHighImpact = requirements.filter(
    (requirement) =>
      requirement.status === "open" &&
      (requirement.criticality === "disqualifier" ||
        requirement.criticality === "high"),
  ).length;

  return (
    <section className="bg-[#f2eee5] px-5 py-20 text-[#111612] md:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr]">
          <div>
            <p className="eyebrow text-[#4d6b31]">Public compliance matrix</p>
            <h2 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.055em] md:text-7xl">
              The requirements that decide whether pricing starts.
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-black/62">
              These items were extracted from the published solicitation. Team
              notes and identities stay private; the source-linked requirement
              record is safe to review and challenge.
            </p>
            <dl className="mt-8 grid grid-cols-3 border-l border-t border-black/20">
              {[
                [requirements.length, "requirements"],
                [requiredWithBid, "with the bid"],
                [openHighImpact, "open high impact"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="border-b border-r border-black/20 p-4"
                >
                  <dd className="text-3xl font-semibold tracking-[-.05em]">
                    {value}
                  </dd>
                  <dt className="eyebrow mt-2 text-black/65">{label}</dt>
                </div>
              ))}
            </dl>
            {opportunity?.bidDueAt !== undefined && (
              <div className="mt-6 border-l-2 border-[#4d6b31] pl-4">
                <p className="eyebrow text-black/65">Offer deadline</p>
                <p className="mt-2 text-xl font-semibold">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/New_York",
                  }).format(opportunity.bidDueAt)}
                </p>
              </div>
            )}
          </div>

          <ol className="border-t border-black/20">
            {[...requirements]
              .sort((left, right) => {
                const severity = { disqualifier: 0, high: 1, standard: 2 };
                return severity[left.criticality] - severity[right.criticality];
              })
              .map((requirement, index) => (
                <li
                  key={requirement._id}
                  className="grid gap-4 border-b border-black/20 py-5 md:grid-cols-[42px_minmax(0,1fr)_150px]"
                >
                  <span className="font-mono text-xs font-semibold text-[#4d6b31]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[.14em] ${
                          requirement.criticality === "disqualifier"
                            ? "bg-[#ff6b57]"
                            : requirement.criticality === "high"
                              ? "bg-[#e9b94f]"
                              : "bg-black/10"
                        }`}
                      >
                        {requirement.criticality}
                      </span>
                      <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-black/65">
                        {requirement.category}
                      </span>
                      {requirement.requiredWithBid && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#4d6b31]">
                          <FileCheck2 className="size-3" /> with bid
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold tracking-[-.02em]">
                      {requirement.text}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-black/65">
                      {requirement.dueDateText && (
                        <span>Due: {requirement.dueDateText}</span>
                      )}
                      <a
                        href={requirement.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#4d6b31] hover:underline"
                      >
                        Source <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <span className="inline-flex rounded-full border border-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em]">
                      {requirement.status.replace("_", " ")}
                    </span>
                  </div>
                </li>
              ))}
          </ol>
        </div>
        <p className="mt-6 text-right text-xs text-black/65">
          {resolved} of {requirements.length} requirements resolved by the team
        </p>
      </div>
    </section>
  );
}

function replaceClaimIds(text: string, nodes: EvidenceNode[]) {
  const claimNumbers = new Map(
    nodes
      .filter((node) => node.kind === "claim")
      .map((node, index) => [node.id, index + 1] as const),
  );
  return text.replace(/\[([^\]]+)\]/g, (match, id: string) => {
    const number = claimNumbers.get(id);
    return number === undefined
      ? match
      : `[Claim ${String(number).padStart(2, "0")}]`;
  });
}

function DecisionBrief({
  brief,
  nodes,
  edges,
}: {
  brief: PublicBrief;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}) {
  const claims = nodes.filter((node) => node.kind === "claim");
  const sources = new Map(
    nodes
      .filter((node) => node.kind === "source")
      .map((node) => [node.id, node] as const),
  );

  return (
    <section
      id="decision-brief"
      className="scroll-mt-8 bg-[#f2eee5] px-5 py-20 text-[#111612] md:px-8 lg:px-12 lg:py-28"
    >
      <div className="mx-auto grid max-w-[1400px] gap-12 lg:grid-cols-[.62fr_1.38fr]">
        <div>
          <p className="eyebrow text-[#4d6b31]">Complete decision brief</p>
          <h2 className="mt-5 text-5xl font-semibold leading-[.92] tracking-[-.055em] md:text-7xl">
            {brief.title}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-black/65">
            {brief.summary}
          </p>
        </div>
        <div className="border-t border-black/20 py-2">
          <Markdown
            components={{
              h1: ({ node: _node, ...props }) => (
                <h3
                  className="border-b border-black/20 pb-4 pt-7 text-2xl font-semibold tracking-[-.03em]"
                  {...props}
                />
              ),
              h2: ({ node: _node, ...props }) => (
                <h3
                  className="border-b border-black/20 pb-4 pt-7 text-2xl font-semibold tracking-[-.03em]"
                  {...props}
                />
              ),
              h3: ({ node: _node, ...props }) => (
                <h3
                  className="border-b border-black/20 pb-4 pt-7 text-xl font-semibold tracking-[-.025em]"
                  {...props}
                />
              ),
              p: ({ node: _node, ...props }) => (
                <p
                  className="py-3 text-base leading-[1.75] text-black/72"
                  {...props}
                />
              ),
              ul: ({ node: _node, ...props }) => (
                <ul
                  className="my-3 list-disc space-y-2 pl-6 text-base leading-[1.7] text-black/72 marker:text-[#4d6b31]"
                  {...props}
                />
              ),
              ol: ({ node: _node, ...props }) => (
                <ol
                  className="my-3 list-decimal space-y-2 pl-6 text-base leading-[1.7] text-black/72 marker:font-semibold marker:text-[#4d6b31]"
                  {...props}
                />
              ),
              strong: ({ node: _node, ...props }) => (
                <strong className="font-semibold text-black" {...props} />
              ),
            }}
          >
            {brief.body}
          </Markdown>
        </div>
        <div className="lg:col-start-2">
          <p className="eyebrow text-[#4d6b31]">Citation index</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/60">
            Every citation marker in the brief resolves to a structured claim
            and its original public source.
          </p>
          <ol className="mt-6 border-t border-black/20">
            {claims.map((claim, index) => {
              const sourceLinks = edges
                .filter((edge) => edge.target === claim.id)
                .map((edge) => sources.get(edge.source))
                .filter(
                  (source): source is EvidenceNode => source !== undefined,
                );
              return (
                <li
                  key={claim.id}
                  className="grid gap-3 border-b border-black/20 py-5 md:grid-cols-[92px_1fr]"
                >
                  <span className="font-mono text-xs font-semibold text-[#4d6b31]">
                    Claim {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-relaxed">
                      {claim.label}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
                      {sourceLinks.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-[#4d6b31] underline-offset-4 hover:underline"
                        >
                          {source.label} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ProcessProof({ process }: { process: PublicProcess }) {
  const operations = [
    {
      name: "Package capture",
      value: `${process.pagesProcessed} pages processed`,
      detail:
        "Collected only the authorized public package and its bounded source set.",
      verified: process.pagesProcessed > 0,
    },
    {
      name: "Requirement trace",
      value: `${process.claimCount} claims structured`,
      detail: "Kept every bid requirement attached to its originating passage.",
      verified: process.claimCount > 0,
    },
    {
      name: "Review loop",
      value:
        process.deliveryCount > 0
          ? `${process.deliveryCount} brief ${process.deliveryCount === 1 ? "delivery" : "deliveries"}`
          : "Ready for team review",
      secondaryValue:
        process.verifiedReplyCount > 0
          ? `${process.verifiedReplyCount} verified ${process.verifiedReplyCount === 1 ? "reply" : "replies"}`
          : undefined,
      detail:
        process.verifiedReplyCount > 0
          ? "Delivered the record and returned verified replies for human review."
          : process.deliveryCount > 0
            ? "Delivered the record; a team reply is still pending."
            : "No review message has been delivered yet.",
      verified: process.deliveryCount > 0,
    },
  ];

  return (
    <section className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow text-[#c7ff4a]">Versioned operating record</p>
            <h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.055em] md:text-7xl">
              Every state change has receipts.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/58">
              Package capture, requirement trace, follow-up, and human review
              remain synchronized while this public projection excludes private
              team data.
            </p>
          </div>
          <div>
            <div className="grid border-l border-t border-white/20 md:grid-cols-3">
              {operations.map((operation) => (
                <article
                  key={operation.name}
                  className="min-h-52 border-b border-r border-white/20 p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold">{operation.name}</p>
                    {operation.verified ? (
                      <CheckCircle2 className="size-4 text-[#c7ff4a]" />
                    ) : (
                      <>
                        <span
                          className="size-2 rounded-full border border-white/40"
                          aria-hidden="true"
                        />
                        <span className="sr-only">Pending</span>
                      </>
                    )}
                  </div>
                  <p className="mt-12 text-2xl font-semibold tracking-[-.035em]">
                    {operation.value}
                  </p>
                  {operation.secondaryValue && (
                    <p className="mt-1 text-lg font-semibold tracking-[-.025em] text-[#c7ff4a]">
                      {operation.secondaryValue}
                    </p>
                  )}
                  <p className="mt-3 text-xs leading-relaxed text-white/55">
                    {operation.detail}
                  </p>
                </article>
              ))}
            </div>
            <ol className="mt-10 border-t border-white/20">
              {process.events.map((event, index) => (
                <li
                  key={`${event.type}-${event.label}-${index}`}
                  className="grid grid-cols-[48px_88px_1fr] gap-4 border-b border-white/20 py-4 text-sm"
                >
                  <span className="font-mono text-xs text-[#c7ff4a]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs uppercase tracking-[.12em] text-white/50">
                    {event.type}
                  </span>
                  <span>{event.label}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

function GardenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-white">
      <LoaderCircle className="animate-spin" />
      <span className="sr-only">Loading decision brief</span>
    </div>
  );
}

function UnavailableGarden() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f2eee5] p-6">
      <div className="text-center">
        <p className="eyebrow">Decision unavailable</p>
        <h1 className="mt-4 font-editorial text-5xl">
          This research brief is private or revoked.
        </h1>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 text-sm underline"
        >
          <ArrowLeft className="size-4" /> Return home
        </Link>
      </div>
    </div>
  );
}
