import { lazy, Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient, useQuery } from "convex/react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  CircleDot,
  ExternalLink,
  Menu,
  Orbit,
  Radar,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import { EvidenceGraph } from "@/components/observatory/EvidenceGraph";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { EvidenceEdge, EvidenceNode } from "@/lib/graph-types";

const BackendApp = lazy(() => import("@/backend/BackendApp"));
const PublicGardenPage = lazy(() => import("@/backend/PublicGardenPage"));
const backendConfigured = Boolean(import.meta.env.VITE_CONVEX_URL);
const featuredGardenSlug = "should-we-bid-on-the-construction-of-86cb535e";
const featuredGardenPath = `/garden/${featuredGardenSlug}`;
const featuredGardenClient = new ConvexReactClient(
  "https://resilient-salamander-937.convex.cloud",
);

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                <ConvexProvider client={featuredGardenClient}>
                  <LandingPage />
                </ConvexProvider>
              }
            />
            <Route
              path="/app/*"
              element={
                backendConfigured ? <BackendApp /> : <LocalSetupNotice />
              }
            />
            <Route path="/garden/:slug" element={<PublicGardenRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
}

function useStaticMode() {
  const [staticMode, setStaticMode] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStaticMode(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return [staticMode, setStaticMode] as const;
}

function LandingPage() {
  const garden = useQuery(api.gardens.getPublic, { slug: featuredGardenSlug });
  const sourceNodes: EvidenceNode[] =
    garden?.sources.map((source, index) => ({
      id: source._id,
      label: source.title,
      detail: source.excerpt,
      kind: "source",
      status: "supported",
      confidence: 0.98,
      url: source.url,
      x: Math.cos(index * 2.4) * 0.72,
      y: Math.sin(index * 2.4) * 0.72,
    })) ?? [];
  const claimNodes: EvidenceNode[] =
    garden?.claims.map((claim) => ({
      id: claim._id,
      label: claim.summary,
      detail: claim.text,
      kind: "claim",
      status: claim.status,
      confidence: claim.confidence,
      x: claim.positionX,
      y: claim.positionY,
    })) ?? [];
  const nodes = [...sourceNodes, ...claimNodes];
  const edges: EvidenceEdge[] =
    garden?.links.map((link) => ({
      id: link._id,
      source: link.sourceId,
      target: link.claimId,
      support: link.support,
    })) ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const [staticMode, setStaticMode] = useStaticMode();
  return (
    <div className="min-h-screen bg-[#f2eee5] text-[#111612]">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="content">
        <section className="hero-grid border-b border-black/20 px-5 pb-8 pt-8 md:px-8 lg:px-12 lg:pb-12 lg:pt-12">
          <div className="flex min-h-[620px] flex-col justify-between border-black/20 pb-8 lg:border-r lg:pr-10">
            <div>
              <div className="mb-9 flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="border-black/30 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[.2em]"
                >
                  Convex All Gas Hackathon
                </Badge>
                <span className="text-xs text-black/60">
                  Pre-bid readiness for small federal contractors
                </span>
              </div>
              <h1 className="max-w-[820px] text-[clamp(4rem,8.5vw,8.6rem)] font-semibold leading-[.79] tracking-[-.075em]">
                Know what
                <span className="block font-editorial font-normal italic tracking-[-.055em]">
                  kills the bid.
                </span>
              </h1>
              <p className="mt-10 max-w-[640px] text-balance text-xl leading-[1.35] tracking-[-.025em] md:text-2xl">
                Before you spend days pricing a federal construction
                opportunity, turn its solicitation into a source-linked
                compliance matrix: disqualifiers, missing proof, owners,
                deadlines, and a defensible bid/no-bid record.
              </p>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-full bg-[#111612] px-6 text-[#f2eee5] hover:bg-[#263128]"
              >
                <Link to="/app">
                  Analyze a solicitation <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full border-black/35 bg-transparent px-6 hover:bg-black/5"
              >
                <Link to={featuredGardenPath}>
                  Inspect the production proof
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex min-h-[620px] flex-col pt-8 lg:pl-10 lg:pt-0">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="eyebrow">Live source proof / 01</p>
                <p className="mt-1 text-sm text-black/58">
                  Production construction bid research
                </p>
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={staticMode}
                  onChange={(event) => setStaticMode(event.target.checked)}
                  className="accent-[#111612]"
                />
                Static mode
              </label>
            </div>
            <div className="min-h-0 flex-1">
              {garden === undefined ? (
                <div className="grid h-full min-h-[420px] place-items-center border border-black/20">
                  <Orbit className="animate-spin text-[#4d6b31]" />
                  <span className="sr-only">
                    Loading real production evidence
                  </span>
                </div>
              ) : garden === null ? (
                <div className="grid h-full min-h-[420px] place-items-center border border-black/20 p-8 text-center text-sm text-black/60">
                  The production decision is unavailable.
                </div>
              ) : (
                <EvidenceGraph
                  nodes={nodes}
                  edges={edges}
                  selectedId={selected?.id ?? null}
                  onSelect={(node) => setSelectedId(node.id)}
                  staticMode={staticMode}
                />
              )}
            </div>
            {selected && (
              <div className="mt-4 grid gap-3 border-t border-black/20 pt-4 sm:grid-cols-[130px_1fr]">
                <p className="eyebrow">Selected evidence</p>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-[-.02em]">
                      {selected.label}
                    </h2>
                    <StatusDot status={selected.status} />
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-relaxed text-black/60">
                    {selected.detail}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="border-b border-black/20 px-5 py-6 md:px-8 lg:px-12">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_2fr]">
            <div>
              <p className="eyebrow">Verified production run</p>
              <p className="mt-4 max-w-xl font-editorial text-3xl leading-[1.05] tracking-[-.035em] md:text-4xl">
                {garden?.question ?? "Loading the production analysis…"}
              </p>
            </div>
            <div className="grid grid-cols-2 border-l border-t border-black/20 md:grid-cols-4">
              {[
                [garden?.process.pagesProcessed ?? "—", "pages processed"],
                [garden?.process.sourceCount ?? "—", "trusted sources"],
                [garden?.process.claimCount ?? "—", "linked claims"],
                [garden?.process.deliveryCount ?? "—", "brief deliveries"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="border-b border-r border-black/20 p-5"
                >
                  <p className="text-4xl font-semibold tracking-[-.06em]">
                    {value}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[.17em] text-black/60">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
          <div className="mb-14 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">How it works / 02</p>
              <h2 className="mt-4 max-w-4xl text-5xl font-semibold leading-[.92] tracking-[-.06em] md:text-7xl">
                Make the compliance work happen{" "}
                <span className="font-editorial font-normal italic">
                  before pricing.
                </span>
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-black/58">
              The product does not write a glossy proposal and hope. It helps
              the team decide whether the opportunity deserves estimator time at
              all.
            </p>
          </div>
          <div className="grid border-l border-t border-black/20 md:grid-cols-3">
            <Principle
              number="01"
              icon={<Radar />}
              title="Ingest the real package"
              body="Authorize the solicitation and referenced public documents. Firecrawl stays inside that bounded source set."
            />
            <Principle
              number="02"
              icon={<Sparkles />}
              title="Build the matrix"
              body="OpenAI extracts explicit forms, bonds, eligibility rules, deadlines, and submission instructions with the exact source passage attached."
            />
            <Principle
              number="03"
              icon={<ShieldCheck />}
              title="Resolve and decide"
              body="Assign each requirement, record missing proof, route the brief through AgentMail, and preserve the human bid/no-bid rationale in Convex."
            />
          </div>
        </section>

        <section className="bg-[#0a0d0b] px-5 py-20 text-[#f2eee5] md:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
            <div>
              <p className="eyebrow text-[#c7ff4a]">Proof of work / 03</p>
              <h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">
                A record your team can defend.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-white/58">
                Convex keeps requirements, evidence, owners, decisions, and
                verified reviewer replies synchronized for every collaborator in
                realtime.
              </p>
            </div>
            <ol className="border-t border-white/20">
              {garden?.process.events.map((event, index) => (
                <li
                  key={`${event.type}-${event.label}-${index}`}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-4 border-b border-white/20 py-5"
                >
                  <span className="font-mono text-xs uppercase text-white/52">
                    {event.type}
                  </span>
                  <span className="text-lg tracking-[-.02em]">
                    {event.label}
                  </span>
                  <span className="text-xs text-[#c7ff4a]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </li>
              )) ?? (
                <li className="border-b border-white/20 py-5 text-white/55">
                  Loading verified process events…
                </li>
              )}
            </ol>
          </div>
        </section>

        <section className="px-5 py-20 text-center md:px-8 lg:px-12 lg:py-32">
          <CircleDot className="mx-auto size-8 text-[#4d6b31]" />
          <p className="mx-auto mt-6 max-w-5xl font-editorial text-5xl leading-[.95] tracking-[-.045em] md:text-7xl">
            Bid the work you can win. Catch the requirement that would make the
            rest wasted effort.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-10 h-12 rounded-full bg-[#111612] px-7 text-[#f2eee5]"
          >
            <Link to="/app">
              Open a pre-bid workspace <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  const links = [
    ["How it works", "/#content"],
    ["Production proof", featuredGardenPath],
  ];
  return (
    <header className="sticky top-0 z-50 flex h-[72px] items-center justify-between border-b border-black/20 bg-[#f2eee5]/90 px-5 backdrop-blur-xl md:px-8 lg:px-12">
      <Link
        to="/"
        className="flex items-center gap-2.5 font-semibold tracking-[-.025em]"
      >
        <SignalMark /> Signal Garden
      </Link>
      <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
        {links.map(([label, href]) => (
          <Link
            key={label}
            to={href}
            className="text-sm text-black/60 transition hover:text-black"
          >
            {label}
          </Link>
        ))}
        <Button
          asChild
          size="sm"
          className="rounded-full bg-[#111612] text-[#f2eee5]"
        >
          <Link to="/app">Open workspace</Link>
        </Button>
      </nav>
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
          >
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent className="bg-[#f2eee5] pt-16">
          <nav className="flex flex-col gap-5" aria-label="Mobile navigation">
            {links.map(([label, href]) => (
              <Link key={label} to={href} className="text-2xl font-semibold">
                {label}
              </Link>
            ))}
            <Button asChild className="mt-4 rounded-full">
              <Link to="/app">Open workspace</Link>
            </Button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function SignalMark() {
  return (
    <span
      aria-hidden="true"
      className="relative block size-5 rounded-full border border-current before:absolute before:inset-[5px] before:rounded-full before:bg-[#688f40] after:absolute after:-right-1 after:top-1/2 after:h-px after:w-2 after:bg-current"
    />
  );
}

function Principle({
  number,
  icon,
  title,
  body,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article className="min-h-[340px] border-b border-r border-black/20 p-6 md:p-8">
      <div className="flex items-start justify-between">
        <span className="text-[#4d6b31] [&_svg]:size-6">{icon}</span>
        <span className="font-mono text-xs text-black/60">{number}</span>
      </div>
      <div className="mt-28">
        <h3 className="text-2xl font-semibold tracking-[-.035em]">{title}</h3>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-black/58">
          {body}
        </p>
      </div>
    </article>
  );
}

function StatusDot({ status }: { status: EvidenceNode["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/20 px-2 py-1 text-[9px] font-semibold uppercase tracking-[.15em]">
      <span
        className={`size-1.5 rounded-full ${status === "supported" ? "bg-[#688f40]" : status === "disputed" ? "bg-[#ff6b57]" : "bg-[#708be0]"}`}
      />
      {status}
    </span>
  );
}

function PublicGardenRoute() {
  const { slug = "" } = useParams();
  if (slug === featuredGardenSlug) {
    return (
      <ConvexProvider client={featuredGardenClient}>
        <PublicGardenPage />
      </ConvexProvider>
    );
  }
  return backendConfigured ? (
    <PublicGardenPage />
  ) : (
    <Navigate to={featuredGardenPath} replace />
  );
}

function LocalSetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0d0b] p-6 text-[#f2eee5]">
      <div className="max-w-lg border border-white/20 p-8">
        <SignalMark />
        <p className="eyebrow mt-10 text-[#c7ff4a]">Local interface ready</p>
        <h1 className="mt-4 text-5xl font-semibold leading-[.95] tracking-[-.06em]">
          Connect this checkout to its dedicated Convex deployment.
        </h1>
        <p className="mt-5 leading-relaxed text-white/58">
          Private teams, live crawls, and email review require the isolated
          Signal Garden backend. The published production decision remains
          available read-only.
        </p>
        <Button
          asChild
          variant="outline"
          className="mt-8 rounded-full border-white/30 bg-transparent text-white hover:bg-white/10"
        >
          <Link to={featuredGardenPath}>Open the real decision</Link>
        </Button>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="flex flex-col gap-6 border-t border-black/20 px-5 py-8 text-sm md:flex-row md:items-center md:justify-between md:px-8 lg:px-12">
      <div className="flex items-center gap-2 font-semibold">
        <SignalMark /> Signal Garden · Pre-bid readiness
      </div>
      <p className="text-black/60">
        Built with Convex · OpenAI · Firecrawl · AgentMail · vgpu
      </p>
      <a
        href="https://github.com/vercel-labs/vgpu"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-black/60 hover:text-black"
      >
        GPU instrument details <ExternalLink className="size-3.5" />
      </a>
    </footer>
  );
}

function RouteLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-[#f2eee5]">
      <div className="flex items-center gap-3">
        <Orbit className="animate-spin text-[#c7ff4a]" />
        <span className="eyebrow">Loading the evidence</span>
      </div>
    </div>
  );
}
