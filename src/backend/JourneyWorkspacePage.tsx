import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MailCheck,
  Pause,
  Play,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { WorkspaceLoader } from "@/backend/WorkspaceLoader";

type JourneyDetail = FunctionReturnType<typeof api.journeys.get>;
type JourneyList = FunctionReturnType<typeof api.journeys.list>;

export default function JourneyWorkspacePage() {
  const { journeyId } = useParams();
  const id = journeyId as Id<"customerJourneys"> | undefined;
  const detail = useQuery(api.journeys.get, id ? { journeyId: id } : "skip");
  const journeys = useQuery(
    api.journeys.list,
    detail ? { teamId: detail.journey.teamId } : "skip",
  );
  if (!id || detail === undefined || journeys === undefined) return <WorkspaceLoader />;
  return <JourneyControlRoom detail={detail} journeys={journeys} />;
}

function JourneyControlRoom({ detail, journeys }: { detail: JourneyDetail; journeys: JourneyList }) {
  const activate = useMutation(api.journeys.activate);
  const pause = useMutation(api.journeys.pause);
  const cancelActiveRun = useMutation(api.journeys.cancelActiveRun);
  const runNow = useAction(api.journeyActions.runNow);
  const publish = useMutation(api.journeys.publish);
  const navigate = useNavigate();
  const [activateOpen, setActivateOpen] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [pending, setPending] = useState<"activate" | "run" | "pause" | "cancel" | "publish" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const latestRun = detail.runs[0];
  const activeRun = latestRun && ["queued", "running", "waiting"].includes(latestRun.status);
  const statusTone = detail.journey.status === "incident" ? "border-[#d54f3d]/50 bg-[#d54f3d]/10 text-[#a83222]" : detail.journey.status === "healthy" ? "border-[#4f7134]/40 bg-[#4f7134]/8 text-[#385724]" : "border-black/25 bg-transparent";
  const run = () => {
    setPending("run"); setError(""); setMessage("");
    void runNow({ journeyId: detail.journey._id })
      .then(() => setMessage("The authorized lead-form check is running now."))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The check could not start"))
      .finally(() => setPending(null));
  };
  return (
    <div className="min-h-screen bg-[#f3efe6] text-[#111612]">
      <header className="flex h-[72px] items-center justify-between border-b border-black/20 px-4 md:px-8">
        <div className="flex items-center gap-4"><Button variant="ghost" size="icon" onClick={() => void navigate("/app")} aria-label="Back to checks"><ArrowLeft /></Button><Link to="/" className="hidden items-center gap-2 font-semibold sm:flex"><span className="grid size-6 place-items-center rounded-full bg-[#111612] text-[9px] text-[#c8ff53]">SG</span>Signal Garden</Link></div>
        <div className="flex items-center gap-2">
          {detail.publicSlug ? <Button asChild variant="outline" size="sm" className="rounded-full bg-transparent"><Link to={`/proof/${detail.publicSlug}`}>Public proof <ExternalLink /></Link></Button> : latestRun && <Button variant="outline" size="sm" disabled={pending !== null} className="rounded-full bg-transparent" onClick={() => { setPending("publish"); setError(""); void publish({ journeyId: detail.journey._id }).then((slug) => { setMessage("Public proof is ready."); void navigate(`/proof/${slug}`); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The report could not be published")).finally(() => setPending(null)); }}>{pending === "publish" ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Publish proof</Button>}
          {activeRun && <Button variant="ghost" size="sm" disabled={pending !== null} onClick={() => { setPending("cancel"); setError(""); void cancelActiveRun({ journeyId: detail.journey._id }).then(() => setMessage("The active run was cancelled cleanly." )).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The run could not be cancelled")).finally(() => setPending(null)); }}>{pending === "cancel" ? <LoaderCircle className="animate-spin" /> : <XCircle />} Cancel run</Button>}
          {detail.journey.enabled ? <Button variant="ghost" size="sm" disabled={pending !== null || Boolean(activeRun)} onClick={() => { setPending("pause"); void pause({ journeyId: detail.journey._id }).finally(() => setPending(null)); }}><Pause /> Pause</Button> : <Button size="sm" className="rounded-full" onClick={() => setActivateOpen(true)}><Play /> Activate</Button>}
          <Button size="sm" className="rounded-full bg-[#c8ff53] text-[#111612] hover:bg-[#d8ff80]" disabled={!detail.journey.enabled || pending !== null || Boolean(activeRun)} onClick={run}>{pending === "run" ? <LoaderCircle className="animate-spin" /> : <Play />} Run check now</Button>
        </div>
      </header>
      {(message || error) && <div role={error ? "alert" : "status"} className={error ? "border-b border-[#d54f3d]/30 bg-[#d54f3d]/8 px-6 py-3 text-sm text-[#a83222]" : "border-b border-[#4f7134]/25 bg-[#4f7134]/8 px-6 py-3 text-sm text-[#385724]"}>{error || message}</div>}
      <main className="grid min-h-[calc(100vh-72px)] lg:grid-cols-[260px_minmax(0,1fr)_340px]">
        <aside className="hidden border-r border-black/20 p-4 lg:block">
          <div className="flex items-center justify-between px-2 py-3"><p className="eyebrow">Lead-form checks</p><span className="font-mono text-xs text-black/40">{journeys.length}</span></div>
          <nav className="mt-3 space-y-1" aria-label="Lead-form checks">
            {journeys.map((journey) => <Link key={journey._id} to={`/app/journeys/${journey._id}`} className={journey._id === detail.journey._id ? "block border border-black/20 bg-[#ded9ce] p-3" : "block border border-transparent p-3 hover:border-black/15"}><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold leading-tight">{journey.name}</p><span className={journey.status === "incident" ? "size-2 shrink-0 rounded-full bg-[#d54f3d]" : journey.status === "healthy" ? "size-2 shrink-0 rounded-full bg-[#4f7134]" : "size-2 shrink-0 rounded-full bg-black/25"} /></div><p className="mt-2 text-[11px] capitalize text-black/45">{journey.enabled ? journey.status : "draft"}</p></Link>)}
          </nav>
        </aside>
        <section className="min-w-0 border-r border-black/20">
          <div className="border-b border-black/20 p-6 md:p-9">
            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={statusTone}>{detail.journey.enabled ? detail.journey.status : "Draft"}</Badge><Badge variant="outline" className="border-black/20 bg-transparent capitalize">{detail.journey.kind.replace("_", " ")}</Badge><span className="text-xs text-black/42">{detail.journey.cadence === "manual" ? "Manual checks" : `Checks ${detail.journey.cadence}`}</span></div>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[.92] tracking-[-.06em] md:text-7xl">{detail.journey.name}</h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-black/58">{detail.journey.goal}</p>
            <a href={detail.journey.startUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-xs text-black/50 hover:text-black"><Globe2 className="size-3" /> {new URL(detail.journey.startUrl).hostname}{new URL(detail.journey.startUrl).pathname} <ExternalLink className="size-3" /></a>
          </div>
          <div className="grid gap-px border-b border-black/20 bg-black/20 sm:grid-cols-3">
            <SummaryMetric label="Last run" value={detail.journey.lastRunAt ? formatTime(detail.journey.lastRunAt) : "Never"} />
            <SummaryMetric label="Next run" value={detail.journey.enabled && detail.journey.nextRunAt ? formatTime(detail.journey.nextRunAt) : "Paused"} />
            <SummaryMetric label="Reply promise" value={`${detail.journey.expectedReplyMinutes} min`} />
          </div>
          <div className="p-6 md:p-9">
            <div className="flex items-end justify-between"><div><p className="eyebrow">Latest check</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.045em]">Page, form, and confirmation.</h2></div>{latestRun && <span className="text-xs capitalize text-black/45">{latestRun.status} · {formatTime(latestRun.startedAt)}</span>}</div>
            {latestRun ? <RunTimeline run={latestRun} /> : <JourneyPlan steps={detail.steps} />}
            {detail.runs.length > 1 && <div className="mt-12"><p className="eyebrow">Check history</p><div className="mt-4 divide-y divide-black/12 border-y border-black/15">{detail.runs.slice(1, 8).map((runItem) => <div key={runItem._id} className="flex items-center justify-between py-4 text-sm"><div className="flex items-center gap-3"><StatusIcon status={runItem.status} /><span className="capitalize">{runItem.status}</span><span className="text-black/42">{runItem.summary ?? "Check recorded"}</span></div><time className="text-xs text-black/42">{formatTime(runItem.startedAt)}</time></div>)}</div></div>}
          </div>
        </section>
        <aside className="p-5 md:p-7">
          <div className="flex items-center justify-between"><p className="eyebrow">Failures</p><Badge variant="outline" className="border-black/20 bg-transparent">{detail.incidents.filter((incident) => incident.status === "open").length} open</Badge></div>
          <div className="mt-5 space-y-3">{detail.incidents.filter((incident) => incident.status === "open").map((incident) => <IncidentCard key={incident._id} incident={incident} />)}{detail.incidents.every((incident) => incident.status !== "open") && <div className="border border-black/15 p-5"><CheckCircle2 className="size-5 text-[#4f7134]" /><h2 className="mt-4 text-lg font-semibold">No failures detected.</h2><p className="mt-2 text-sm leading-relaxed text-black/50">If the page, form, confirmation, or promised reply fails, the owner gets an email and the evidence appears here.</p></div>}</div>
          <div className="mt-8 border-t border-black/15 pt-6"><p className="eyebrow">What this check covers</p><div className="mt-4 space-y-3">{detail.steps.map((step) => <div key={step._id} className="flex items-start gap-3"><span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-black/20 font-mono text-[9px]">{step.order + 1}</span><div><p className="text-sm font-semibold">{step.label}</p><p className="mt-1 text-xs leading-relaxed text-black/45">{step.instruction}</p></div></div>)}</div></div>
        </aside>
      </main>
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent className="bg-[#f3efe6] sm:max-w-lg"><DialogHeader><DialogTitle className="text-3xl tracking-[-.045em]">Authorize this real lead-form check.</DialogTitle><DialogDescription>Signal Garden will submit the reviewed public form using a clearly labeled QA identity. It will never enter payment, login, sensitive personal data, upload files, bypass a captcha, or submit more than once per check.</DialogDescription></DialogHeader><div className="border border-black/15 p-4"><p className="text-sm font-semibold">{detail.journey.name}</p><p className="mt-1 text-xs text-black/50">{detail.journey.startUrl}</p></div><label className="flex items-start justify-between gap-5 text-sm leading-relaxed"><span>I own this website or have permission to test it, and I approve the exact public form check described above.</span><Switch checked={authorized} onCheckedChange={setAuthorized} className="mt-1" /></label><Button disabled={!authorized || pending !== null} className="h-12 w-full rounded-full" onClick={() => { setPending("activate"); setError(""); void activate({ journeyId: detail.journey._id, authorizedPublicFormTesting: authorized }).then(() => { setActivateOpen(false); setMessage("Check activated. It will run on schedule or when you choose Run check now."); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The check could not be activated")).finally(() => setPending(null)); }}>{pending === "activate" ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Authorize and activate</Button></DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) { return <div className="bg-[#f3efe6] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-black/38">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></div>; }

function JourneyPlan({ steps }: { steps: Array<{ _id: Id<"journeySteps">; order: number; kind: "website" | "form" | "confirmation" | "human_reply"; label: string; instruction: string }> }) {
  return <div className="mt-7 border-l border-t border-black/20">{steps.map((step) => <article key={step._id} className="grid grid-cols-[58px_1fr] border-b border-r border-black/20"><div className="grid place-items-center border-r border-black/20 py-6 font-mono text-xs text-[#4f7134]">0{step.order + 1}</div><div className="p-5"><h3 className="text-xl font-semibold tracking-[-.03em]">{step.kind === "confirmation" ? "Confirmation issued" : step.label}</h3><p className="mt-2 text-sm leading-relaxed text-black/52">{step.instruction}</p></div></article>)}</div>;
}

function RunTimeline({ run }: { run: JourneyDetail["runs"][number] }) {
  return <div className="mt-7 border border-black/20 bg-[#ded9ce]"><div className="flex flex-col justify-between gap-3 border-b border-black/15 p-5 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">{run.summary ?? "Lead-form check in progress"}</p><p className="mt-1 text-xs capitalize text-black/45">{run.trigger} check</p></div><Badge variant="outline" className="w-fit border-black/20 bg-transparent capitalize">{run.status}</Badge></div><div className="grid gap-px bg-black/15 md:grid-cols-2">{run.checkpoints.map((checkpoint) => <article key={checkpoint._id} className="min-h-40 bg-[#f3efe6] p-5"><div className="flex items-center justify-between"><CheckpointIcon kind={checkpoint.kind} status={checkpoint.status} /><span className="font-mono text-[10px] uppercase tracking-[.14em] text-black/38">{checkpoint.status}</span></div><h3 className="mt-6 text-xl font-semibold tracking-[-.03em]">{checkpoint.kind === "confirmation" ? "Confirmation issued" : checkpoint.label}</h3><p className="mt-2 text-xs leading-relaxed text-black/50">{checkpoint.detail ?? "Waiting for this step."}</p>{checkpoint.evidenceExcerpt && <p className="mt-3 border-l-2 border-[#4f7134] pl-3 text-xs leading-relaxed text-black/45">{checkpoint.evidenceExcerpt}</p>}</article>)}</div></div>;
}

function CheckpointIcon({ kind, status }: { kind: "website" | "form" | "confirmation" | "human_reply"; status: string }) {
  if (status === "verified") return <span className="grid size-8 place-items-center rounded-full bg-[#4f7134] text-white"><Check className="size-4" /></span>;
  if (status === "failed") return <span className="grid size-8 place-items-center rounded-full bg-[#d54f3d] text-white"><CircleAlert className="size-4" /></span>;
  const Icon = kind === "website" ? Globe2 : kind === "form" ? Send : kind === "confirmation" ? MailCheck : Clock3;
  return <span className="grid size-8 place-items-center rounded-full border border-black/20"><Icon className="size-4" /></span>;
}

function StatusIcon({ status }: { status: string }) { if (status === "healthy") return <CheckCircle2 className="size-4 text-[#4f7134]" />; if (status === "incident" || status === "error") return <CircleAlert className="size-4 text-[#d54f3d]" />; return <Clock3 className="size-4 text-black/45" />; }

function IncidentCard({ incident }: { incident: JourneyDetail["incidents"][number] }) {
  const resolve = useMutation(api.journeys.resolveIncident);
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <><article className="border border-[#d54f3d]/35 bg-[#d54f3d]/7 p-5"><div className="flex items-center justify-between"><CircleAlert className="size-5 text-[#d54f3d]" /><Badge className="bg-[#d54f3d] text-white">{incident.severity.replace("_", " ")}</Badge></div><h2 className="mt-5 text-xl font-semibold tracking-[-.035em]">{incident.title}</h2><p className="mt-2 text-sm leading-relaxed text-black/55">{incident.detail}</p><Button variant="outline" className="mt-5 w-full rounded-full border-black/25 bg-transparent" onClick={() => setOpen(true)}>Assign and resolve <ArrowRight /></Button></article><Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-[#f3efe6]"><DialogHeader><DialogTitle>{incident.title}</DialogTitle><DialogDescription>Record who owns the fix and what changed. A later real run provides the verification.</DialogDescription></DialogHeader><div><Label htmlFor={`owner-${incident._id}`}>Owner</Label><Input id={`owner-${incident._id}`} value={owner} onChange={(event) => setOwner(event.target.value)} className="mt-2" required /></div><div><Label htmlFor={`note-${incident._id}`}>Resolution note</Label><Textarea id={`note-${incident._id}`} value={note} onChange={(event) => setNote(event.target.value)} className="mt-2" required /></div>{error && <p role="alert" className="text-sm text-[#a83222]">{error}</p>}<Button disabled={pending || owner.length < 2 || note.length < 2} className="w-full rounded-full" onClick={() => { setPending(true); setError(""); void resolve({ incidentId: incident._id, ownerLabel: owner, resolutionNote: note }).then(() => setOpen(false)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The incident could not be resolved")).finally(() => setPending(false)); }}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />} Mark resolved</Button></DialogContent></Dialog></>;
}

function formatTime(timestamp: number) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(timestamp); }
