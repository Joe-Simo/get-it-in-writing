import { lazy, Suspense, useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
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
  Check,
  CircleAlert,
  ExternalLink,
  FileDiff,
  LockKeyhole,
  Menu,
  Orbit,
  RadioTower,
  Route as RouteIcon,
  Send,
  ShieldCheck,
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
  const [staticMode, setStaticMode] = useStaticMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const control = garden?.control;

  return (
    <div className="min-h-screen bg-[#f2eee5] text-[#111612]">
      <a href="#content" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="content">
        <section className="border-b border-black/20 px-5 py-7 md:px-8 lg:px-12 lg:py-10">
          <div className="grid min-h-[600px] border-l border-t border-black/20 lg:grid-cols-[1.04fr_.96fr]">
            <div className="flex flex-col justify-between border-b border-r border-black/20 p-6 md:p-9 lg:p-12">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge
                    variant="outline"
                    className="border-black/30 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[.2em]"
                  >
                    Bid package control
                  </Badge>
                  <span className="text-xs text-black/55">
                    For construction estimating teams
                  </span>
                </div>
                <h1 className="mt-10 max-w-[920px] text-[clamp(4rem,7.6vw,7.6rem)] font-semibold leading-[.78] tracking-[-.078em]">
                  Never price
                  <span className="block font-editorial font-normal italic tracking-[-.055em]">
                    a stale package.
                  </span>
                </h1>
                <p className="mt-10 max-w-[680px] text-balance text-xl leading-[1.35] tracking-[-.025em] md:text-2xl">
                  Signal Garden watches the live solicitation, traces every
                  amendment into the work it changes, and keeps bid release
                  locked until the right people clear the impact.
                </p>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-[#111612] px-6 text-[#f2eee5] hover:bg-[#263128]"
                >
                  <Link to="/app">
                    Open the control room <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-full border-black/35 bg-transparent px-6 hover:bg-black/5"
                >
                  <Link to={featuredGardenPath}>Inspect the live bid</Link>
                </Button>
              </div>
            </div>
            <LiveReleasePanel garden={garden} />
          </div>
        </section>

        <section
          id="change-flow"
          className="px-5 py-20 md:px-8 lg:px-12 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="eyebrow">One change, every consequence / 01</p>
              <h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">
                The amendment enters once.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed text-black/58">
                Scope, price, schedule, forms, bonds, and trade coverage stop
                living in separate inboxes and spreadsheets. Every consequence
                stays attached to the changed source text.
              </p>
            </div>
            <div className="relative border-l border-t border-black/20">
              {[
                {
                  index: "V+1",
                  icon: FileDiff,
                  title: "Capture a new package version",
                  body: "The notice and public document inventory are stored as a new immutable baseline—not overwritten.",
                },
                {
                  index: "Δ",
                  icon: RouteIcon,
                  title: "Route exact impacts",
                  body: "Each changed passage becomes a source-linked action for the estimator, PM, trade partner, or bond agent.",
                },
                {
                  index: "→",
                  icon: Send,
                  title: "Keep the reply with the risk",
                  body: "Questions go to the responsible contact. Replies return to the same bid impact instead of disappearing in email.",
                },
                {
                  index: "✓",
                  icon: LockKeyhole,
                  title: "Release only when it is clear",
                  body: "Material impacts and required-with-bid items must be resolved before a person can approve the final package.",
                },
              ].map(({ index, icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="grid min-h-40 grid-cols-[64px_1fr] border-b border-r border-black/20"
                >
                  <div className="flex flex-col items-center justify-between border-r border-black/20 py-5">
                    <span className="font-mono text-xs text-[#4d6b31]">
                      {index}
                    </span>
                    <Icon className="size-5 text-[#4d6b31]" />
                  </div>
                  <div className="p-5 md:p-7">
                    <h3 className="text-2xl font-semibold tracking-[-.035em]">
                      {title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/58">
                      {body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="live-bid"
          className="border-y border-black/20 bg-[#0a0d0b] px-5 py-20 text-[#f2eee5] md:px-8 lg:px-12 lg:py-28"
        >
          <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-[#c7ff4a]">Live source control / 02</p>
              <h2 className="mt-4 max-w-4xl text-5xl font-semibold leading-[.92] tracking-[-.06em] md:text-7xl">
                Inspect the bid, not our claims.
              </h2>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-white/65">
              <input
                type="checkbox"
                checked={staticMode}
                onChange={(event) => setStaticMode(event.target.checked)}
                className="accent-[#c7ff4a]"
              />
              Static graph
            </label>
          </div>
          <div className="grid border-l border-t border-white/20 lg:grid-cols-[1.4fr_.6fr]">
            <div className="min-h-[540px] border-b border-r border-white/20 p-3 md:p-5">
              {garden === undefined ? (
                <div className="grid h-full min-h-[500px] place-items-center">
                  <Orbit className="animate-spin text-[#c7ff4a]" />
                  <span className="sr-only">Loading the live bid record</span>
                </div>
              ) : garden === null ? (
                <div className="grid h-full min-h-[500px] place-items-center p-8 text-center text-white/55">
                  The public bid record is unavailable.
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
            <aside className="border-b border-r border-white/20 p-6 md:p-8">
              <p className="eyebrow text-[#c7ff4a]">Selected source path</p>
              <h3 className="mt-6 text-3xl font-semibold tracking-[-.045em]">
                {selected?.label ?? "Loading source evidence…"}
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-white/58">
                {selected?.detail ??
                  "Every requirement stays connected to the public passage that created it."}
              </p>
              {selected?.url && (
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex items-center gap-2 text-sm text-[#c7ff4a] hover:underline"
                >
                  Open original source <ExternalLink className="size-4" />
                </a>
              )}
              <dl className="mt-10 border-t border-white/20">
                {[
                  [garden?.process.sourceCount ?? "—", "public sources"],
                  [garden?.requirements.length ?? "—", "bid requirements"],
                  [control?.blockers.length ?? "—", "release blockers shown"],
                ].map(([value, label]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border-b border-white/20 py-4"
                  >
                    <dt className="text-xs uppercase tracking-[.15em] text-white/45">
                      {label}
                    </dt>
                    <dd className="text-xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
        </section>

        <section
          id="release-gate"
          className="px-5 py-20 md:px-8 lg:px-12 lg:py-28"
        >
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-start">
            <div>
              <p className="eyebrow">Human release gate / 03</p>
              <h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">
                “We saw it” is not clearance.
              </h2>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-black/60">
                A bid remains blocked while a material amendment impact, a
                required submission item, or the package baseline is unresolved.
                Approval records who released it and why.
              </p>
            </div>
            <div className="border-l border-t border-black/20">
              {[
                "No silent package overwrite",
                "No impact without the changed source passage",
                "No automatic bid decision",
                "No release while a material item is open",
              ].map((item, index) => (
                <div
                  key={item}
                  className="grid min-h-24 grid-cols-[72px_1fr] items-center border-b border-r border-black/20"
                >
                  <span className="grid h-full place-items-center border-r border-black/20 font-mono text-xs text-[#4d6b31]">
                    0{index + 1}
                  </span>
                  <p className="flex items-center gap-3 px-5 text-lg font-semibold tracking-[-.025em]">
                    <Check className="size-4 text-[#4d6b31]" /> {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-black/20 px-5 py-24 text-center md:px-8 lg:px-12 lg:py-32">
          <RadioTower className="mx-auto size-8 text-[#4d6b31]" />
          <p className="mx-auto mt-7 max-w-5xl font-editorial text-5xl leading-[.95] tracking-[-.045em] md:text-7xl">
            The package will change. Your bid should know what changed with it.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-10 h-12 rounded-full bg-[#111612] px-7 text-[#f2eee5]"
          >
            <Link to="/app">
              Track a live bid <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

type GardenResult =
  FunctionReturnType<typeof api.gardens.getPublic> | undefined;

function LiveReleasePanel({ garden }: { garden: GardenResult }) {
  const control = garden?.control;
  const state = control?.state ?? "blocked";
  const stateLabel = garden === undefined ? "Loading" : state;
  return (
    <aside className="flex min-h-[600px] flex-col border-b border-r border-black/20 bg-[#e8e3d8]">
      <div className="flex items-start justify-between border-b border-black/20 p-6 md:p-8">
        <div>
          <p className="eyebrow">Live release gate</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-black/65">
            {garden?.opportunity?.title ?? "Loading the current bid record…"}
          </p>
        </div>
        <Badge
          className={
            state === "approved"
              ? "bg-[#587938] text-white"
              : state === "ready"
                ? "bg-[#c7ff4a] text-[#111612]"
                : "bg-[#111612] text-[#f2eee5]"
          }
        >
          {stateLabel}
        </Badge>
      </div>
      <div className="grid grid-cols-3 border-b border-black/20">
        {[
          [control?.packageVersion ?? "—", "package version"],
          [control?.impactCount ?? "—", "change impacts"],
          [control?.blockers.length ?? "—", "release holds"],
        ].map(([value, label]) => (
          <div
            key={label}
            className="border-r border-black/20 p-4 last:border-r-0"
          >
            <p className="text-3xl font-semibold tracking-[-.06em]">{value}</p>
            <p className="mt-2 text-[9px] font-semibold uppercase tracking-[.16em] text-black/70">
              {label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex-1 p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow">What holds release</p>
          <LockKeyhole className="size-5" />
        </div>
        <ol className="mt-5 border-t border-black/20">
          {control?.blockers.slice(0, 5).map((blocker, index) => (
            <li
              key={`${blocker.kind}-${blocker.title}`}
              className="grid grid-cols-[34px_1fr_auto] items-start gap-3 border-b border-black/20 py-4"
            >
              <span className="font-mono text-xs text-[#4d6b31]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold leading-snug">
                {blocker.title}
              </span>
              <span className="text-[9px] uppercase tracking-[.13em] text-black/70">
                {blocker.kind}
              </span>
            </li>
          )) ?? (
            <li className="border-b border-black/20 py-5 text-sm text-black/55">
              Loading current release holds…
            </li>
          )}
          {control !== undefined && control.blockers.length === 0 && (
            <li className="flex items-center gap-3 border-b border-black/20 py-5 text-sm font-semibold">
              <ShieldCheck className="size-5 text-[#4d6b31]" /> No material
              holds remain.
            </li>
          )}
        </ol>
      </div>
      <div className="border-t border-black/20 p-6 md:p-8">
        <div className="flex items-center gap-3">
          <CircleAlert className="size-5 text-[#4d6b31]" />
          <p className="text-sm leading-relaxed text-black/58">
            Release is a human action. New package evidence reopens the gate.
          </p>
        </div>
      </div>
    </aside>
  );
}

function SiteHeader() {
  const links = [
    ["Change flow", "/#change-flow"],
    ["Live bid", "/#live-bid"],
    ["Release gate", "/#release-gate"],
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
          <Link to="/app">Open control room</Link>
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
              <Link to="/app">Open control room</Link>
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
        <h1 className="mt-8 text-4xl font-semibold tracking-[-.05em]">
          Connect this checkout to its dedicated workspace.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/55">
          The public site is available, but the private control room requires
          the project-specific environment configuration.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-full">
          <Link to="/">Return home</Link>
        </Button>
      </div>
    </div>
  );
}

function RouteLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#0a0d0b] text-[#f2eee5]">
      <Orbit className="animate-spin text-[#c7ff4a]" />
      <span className="sr-only">Loading Signal Garden</span>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="grid gap-6 border-t border-black/20 px-5 py-8 text-xs text-black/65 md:grid-cols-3 md:px-8 lg:px-12">
      <p className="font-semibold text-black">Signal Garden</p>
      <p className="md:text-center">
        Bid package control for construction teams.
      </p>
      <p className="md:text-right">Public solicitation material only.</p>
    </footer>
  );
}
