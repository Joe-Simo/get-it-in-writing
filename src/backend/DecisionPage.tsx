import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  FileCheck2,
  GitCompareArrows,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { StatusStamp } from "@/backend/DashboardPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const terminalStatuses = new Set([
  "fully_established",
  "confirmed",
  "confirmed_with_conditions",
  "partially_confirmed",
  "not_confirmed",
  "needs_followup",
  "declined",
]);

type Evidence = {
  _id: string;
  assessmentId: Id<"claimAssessments">;
  sourceUrl: string;
  sourceTitle?: string;
  sourceExcerpt: string;
  supports: boolean;
};

export default function DecisionPage() {
  const { decisionId } = useParams();
  const navigate = useNavigate();
  const queryArgs = decisionId ? { decisionId: decisionId as Id<"decisions"> } : "skip";
  const detail = useQuery(api.decisions.getDetail, queryArgs);
  const progress = useQuery(api.research.progress, queryArgs);
  const retryResearch = useMutation(api.decisions.retryResearch);
  const requestCheck = useMutation(api.changes.requestCheck);
  const acknowledgeChange = useMutation(api.changes.acknowledge);
  const removeDecision = useMutation(api.decisions.remove);
  const request = detail?.requests[0];
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const researchActive = detail && !detail.decision.operationalFailure
    ? ["scoping", "researching", "analyzing", "confirmation_available", "drafting_confirmation"].includes(detail.decision.status)
    : false;
  const evidenceByAssessment = useMemo(() => {
    const grouped = new Map<string, Evidence[]>();
    for (const item of detail?.evidence ?? []) {
      const list = grouped.get(item.assessmentId) ?? [];
      list.push(item);
      grouped.set(item.assessmentId, list);
    }
    return grouped;
  }, [detail?.evidence]);

  if (detail === undefined) return <DecisionLoading />;
  if (detail === null) return <NotFound />;
  const activeDecisionId = detail.decision._id;
  const openChanges = detail.sourceChanges.filter((change) => change.status === "open");

  async function retry() {
    setPending("retry");
    setError("");
    try {
      await retryResearch({ decisionId: activeDecisionId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Research could not be restarted");
    } finally {
      setPending(null);
    }
  }

  async function checkSources() {
    setPending("check");
    setError("");
    try {
      await requestCheck({ decisionId: activeDecisionId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The source check could not be started");
    } finally {
      setPending(null);
    }
  }

  async function acknowledge(sourceChangeId: Id<"sourceChanges">) {
    setPending(sourceChangeId);
    setError("");
    try {
      await acknowledgeChange({ sourceChangeId });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The change could not be acknowledged");
    } finally {
      setPending(null);
    }
  }

  async function deleteCase() {
    setPending("delete");
    setError("");
    try {
      await removeDecision({ decisionId: activeDecisionId });
      void navigate("/app", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The private case could not be deleted");
      setPending(null);
    }
  }

  return (
    <div className="decision-page">
      <Link to="/app" className="back-link"><ArrowLeft /> Promise Wallet</Link>
      <header className="decision-header">
        <div>
          <div className="flex flex-wrap items-center gap-2"><StatusStamp status={detail.decision.status} /><span className="category-chip">{detail.decision.category}</span></div>
          <h1>{detail.decision.title}</h1>
          <a href={detail.decision.sourceUrl} target="_blank" rel="noreferrer" className="source-host"><Link2 /> {detail.decision.sourceHost} <ArrowUpRight /></a>
        </div>
        <div className="decision-private"><LockKeyhole /><span><strong>Private case</strong><small>Only you can see this decision.</small></span></div>
      </header>

      <StatusRail status={detail.decision.status} />

      {openChanges.map((change) => <SourceChangeAlert key={change._id} change={change} pending={pending === change._id} onAcknowledge={() => void acknowledge(change._id)} />)}

      {detail.decision.operationalFailure && (
        <section className="operational-error" role="alert">
          <CircleAlert /><div><strong>The product stopped safely.</strong><p>{detail.decision.operationalMessage}</p></div>
          {(["research_failed", "analysis_failed"] as string[]).includes(detail.decision.operationalFailure) && <Button variant="outline" disabled={pending !== null} onClick={() => void retry()}>{pending === "retry" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Retry research</Button>}
        </section>
      )}
      {error && <p role="alert" className="form-error mb-5">{error}</p>}

      <section className="exact-requirement ticket-shell">
        <div className="ticket-number"><span>{String(detail.requirements.length || 1).padStart(2, "0")}</span><span>DECISION BOUNDARIES</span></div>
        {detail.requirements.length > 0 ? (
          <ol className="requirement-stack">
            {detail.requirements.map((requirement, index) => (
              <li key={requirement._id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <blockquote>{requirement.text}</blockquote>
                  <p>{requirement.importance && <Badge variant="outline">{requirement.importance}</Badge>}{requirement.scope && <small>{requirement.scope}</small>}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : <blockquote>{detail.decision.requirementText}</blockquote>}
        {detail.decision.context && <p><strong>Context:</strong> {detail.decision.context}</p>}
      </section>

      <div className="decision-grid">
        <section className="reliance-map-panel">
          <div className="section-heading"><div><p className="ink-label">Reliance map</p><h2>What you can safely rely on</h2></div><span>{detail.assessments.length || (researchActive ? "…" : 0)}</span></div>
          {researchActive && detail.assessments.length === 0 ? <ResearchInProgress status={detail.decision.status} sourceHost={detail.decision.sourceHost} progress={progress} /> : detail.assessments.length === 0 ? <p className="panel-empty">No reliance map is available yet.</p> : (
            <div className="assessment-list">{detail.assessments.map((assessment) => <Assessment key={assessment._id} assessment={assessment} evidence={evidenceByAssessment.get(assessment._id) ?? []} />)}</div>
          )}
          {detail.sources.length > 0 && <SourceRegister sources={detail.sources} />}
        </section>

        <aside className="case-side">
          {request ? <ConfirmationPanel key={request._id} request={request} contacts={detail.contacts} /> : terminalStatuses.has(detail.decision.status) ? null : <ContactBoundary />}
          <Timeline events={detail.events} />
        </aside>
      </div>

      {detail.replies.length > 0 && <ReplyPanel reply={detail.replies[0]} />}
      {detail.proofCard && <ProofCard card={detail.proofCard} items={detail.proofItems} followUpAlreadyPrepared={detail.requests.some((item) => item.followUpCount >= 1)} checking={pending === "check"} onCheck={() => void checkSources()} />}

      <section className="case-delete" aria-live="polite">
        <div>
          <strong>Delete this private case</strong>
          <p>Removes its requirements, sources, messages, and Proof Card from this wallet. Previously sent email cannot be recalled.</p>
        </div>
        {deleteArmed ? (
          <div className="case-delete-confirm">
            <Button variant="ghost" disabled={pending === "delete"} onClick={() => setDeleteArmed(false)}>Cancel</Button>
            <Button disabled={pending === "delete"} className="case-delete-final" onClick={() => void deleteCase()}>
              {pending === "delete" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Delete permanently
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setDeleteArmed(true)}><Trash2 /> Delete case</Button>
        )}
      </section>
    </div>
  );
}

function StatusRail({ status }: { status: string }) {
  const points = [
    { key: "research", label: "Official web" },
    { key: "map", label: "Reliance map" },
    { key: "request", label: "Written request" },
    { key: "reply", label: "Real reply" },
    { key: "proof", label: "Proof Card" },
  ];
  const index = ["draft", "scoping", "researching"].includes(status) ? 0 : status === "analyzing" ? 1 : ["confirmation_available", "drafting_confirmation", "awaiting_approval", "sending", "waiting"].includes(status) ? 2 : ["reply_received", "interpreting_reply"].includes(status) ? 3 : 4;
  return <ol className="status-rail" aria-label="Decision progress">{points.map((point, pointIndex) => <li key={point.key} className={pointIndex < index ? "done" : pointIndex === index ? "current" : ""}><span>{pointIndex < index ? <Check /> : pointIndex + 1}</span>{point.label}</li>)}</ol>;
}

type ResearchProgress = {
  status: "starting" | "scraping" | "completed" | "failed" | "cancelled";
  completed: number;
  total?: number;
  pageCount: number;
  finalized: boolean;
  pages: Array<{ url: string; title?: string; scrapedAt: number; truncated: boolean }>;
} | null | undefined;

function ResearchInProgress({ status, sourceHost, progress }: { status: string; sourceHost: string; progress: ResearchProgress }) {
  const copy = status === "analyzing" ? "Checking every claim against its exact source passage and scope…" : `Reading ${sourceHost} and the relevant official pages…`;
  return (
    <div className="research-live" aria-live="polite">
      <div className="research-progress"><LoaderCircle className="animate-spin" /><div><strong>{status === "analyzing" ? "Building the reliance map" : "Research in progress"}</strong><p>{copy}</p><small>Nothing is being sent.</small></div></div>
      {progress && (
        <div className="crawl-progress">
          <div><span>{progress.pageCount} official {progress.pageCount === 1 ? "page" : "pages"} opened</span><small>{progress.total ? `${progress.completed} of ${progress.total}` : progress.status}</small></div>
          <ol>{progress.pages.map((page) => {
            const path = new URL(page.url).pathname;
            return <li key={page.url}><CircleCheck /><span><strong>{page.title ?? (path || sourceHost)}</strong><small>{path || "/"}</small></span></li>;
          })}</ol>
        </div>
      )}
    </div>
  );
}

function Assessment({ assessment, evidence }: {
  assessment: { _id: Id<"claimAssessments">; status: string; statement: string; reason: string; assessedScope?: string };
  evidence: Evidence[];
}) {
  const labels: Record<string, string> = { established: "Published by provider", conditional: "Conditional", vague_or_conditional: "Conditional", conflicting: "Conflicting information", scope_mismatch: "Scope mismatch", not_established: "Not established" };
  const icons: Record<string, typeof CircleCheck> = { established: CircleCheck, conditional: CircleDashed, vague_or_conditional: CircleDashed, conflicting: GitCompareArrows, scope_mismatch: AlertTriangle, not_established: CircleAlert };
  const Icon = icons[assessment.status] ?? CircleAlert;
  return (
    <article className={`assessment assessment-${assessment.status}`}>
      <div className="assessment-status"><Icon />{labels[assessment.status] ?? assessment.status}</div>
      <h3>{assessment.statement}</h3>
      {assessment.assessedScope && <p className="assessment-scope">Scope checked: {assessment.assessedScope}</p>}
      <p>{assessment.reason}</p>
      {evidence.length > 0 && <div className="evidence-stack">{evidence.map((item) => <figure key={item._id} className={item.supports ? "supports" : "opposes"}><figcaption>{item.supports ? "Official passage" : "Conflicting passage"}</figcaption><blockquote>“{item.sourceExcerpt}”</blockquote><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceTitle ?? "Open official source"}<ArrowUpRight /></a></figure>)}</div>}
    </article>
  );
}

function SourceRegister({ sources }: { sources: Array<{ _id: string; url: string; title?: string; capturedAt: number; contentHash: string }> }) {
  const latest = [...new Map([...sources].sort((left, right) => right.capturedAt - left.capturedAt).map((source) => [source.url, source])).values()];
  return <details className="source-register"><summary>Source register <span>{latest.length}</span></summary><ol>{latest.map((source) => <li key={source._id}><a href={source.url} target="_blank" rel="noreferrer">{source.title ?? new URL(source.url).hostname}<ArrowUpRight /></a><small>Captured {formatDateTime(source.capturedAt)} · SHA-256 {source.contentHash.slice(0, 12)}…</small></li>)}</ol></details>;
}

type ConfirmationPanelProps = {
  request: { _id: Id<"confirmationRequests">; status: string; recipient?: string; recipientSource: string; subject: string; body: string; sentAt?: number; outboundId?: string; followUpCount: number };
  contacts: Array<{ _id: Id<"officialContacts">; email: string; label: string; sourceUrl: string }>;
};

function ConfirmationPanel({ request, contacts }: ConfirmationPanelProps) {
  const saveDraft = useMutation(api.confirmations.saveDraft);
  const approveAndSend = useMutation(api.confirmations.approveAndSend);
  const providerStatus = useQuery(api.confirmations.sendStatus, request.outboundId ? { requestId: request._id } : "skip");
  const matchingContact = contacts.find((item) => item.email === request.recipient);
  const [recipient, setRecipient] = useState(request.recipient ?? "");
  const [contactChoice, setContactChoice] = useState<string>(matchingContact?._id ?? "manual");
  const [subject, setSubject] = useState(request.subject);
  const [body, setBody] = useState(request.body);
  const [approved, setApproved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<"save" | "send" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const editable = ["draft", "failed", "bounced", "complained", "rejected"].includes(request.status);

  function markEdited() { setDirty(true); setApproved(false); setNotice(""); }

  async function save() {
    const selectedContactId = contactChoice === "manual" ? undefined : contactChoice as Id<"officialContacts">;
    setPending("save"); setError(""); setNotice("");
    try {
      await saveDraft({ requestId: request._id, recipient, ...(selectedContactId ? { contactId: selectedContactId } : {}), subject, body });
      setDirty(false); setApproved(false); setNotice("Saved. Review this exact recipient and message before approving it.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The draft could not be saved"); }
    finally { setPending(null); }
  }

  async function sendRequest() {
    if (dirty) { setError("Save the exact draft before approving it."); return; }
    setPending("send"); setError(""); setNotice("");
    try {
      await approveAndSend({ requestId: request._id, approvedExactRecipientAndMessage: true });
      setApproved(false); setNotice("Your approved request is being sent. Delivery and real replies will update this case.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The request could not be sent"); }
    finally { setPending(null); }
  }

  return (
    <section className="confirmation-panel ticket-shell">
      <div className="section-heading compact"><div><p className="ink-label">{request.followUpCount > 0 ? "One permitted follow-up" : "Written confirmation"}</p><h2>{editable ? "Review the exact request" : "Request sent"}</h2></div><Mail /></div>
      {editable ? <>
        {error && <p role="alert" className="form-error mb-5">{error}</p>}
        {notice && <p role="status" className="form-notice mb-5">{notice}</p>}
        <div className="space-y-5">
          <div><Label>Recipient</Label>{contacts.length > 0 && <Select value={contactChoice} onValueChange={(value) => { setContactChoice(value); const contact = contacts.find((item) => item._id === value); if (contact) setRecipient(contact.email); markEdited(); }}><SelectTrigger className="mt-2 h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{contacts.map((contact) => <SelectItem key={contact._id} value={contact._id}>{contact.label} · {contact.email}</SelectItem>)}<SelectItem value="manual">Enter an address myself</SelectItem></SelectContent></Select>}<Input aria-label="Recipient email" className="mt-2" type="email" value={recipient} onChange={(event) => { setRecipient(event.target.value); if (contactChoice !== "manual") setContactChoice("manual"); markEdited(); }} placeholder="Official contact email" /><p className="field-help">Published contacts are source-checked. A manual address is recorded as provided by you.</p></div>
          <div><Label htmlFor="confirmation-subject">Subject</Label><Input id="confirmation-subject" className="mt-2" value={subject} onChange={(event) => { setSubject(event.target.value); markEdited(); }} maxLength={220} /></div>
          <div><Label htmlFor="confirmation-body">Message</Label><Textarea id="confirmation-body" className="mt-2" rows={9} value={body} onChange={(event) => { setBody(event.target.value); markEdited(); }} maxLength={8000} /></div>
        </div>
        <Button variant="outline" disabled={pending !== null} className="mt-5 w-full rounded-none" onClick={() => void save()}>{pending === "save" ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />} Save exact draft</Button>
        {dirty && <p className="draft-boundary">You changed this draft. Save it before approval.</p>}
        <label className="approval-check"><Checkbox checked={approved} disabled={dirty} onCheckedChange={(value) => setApproved(value === true)} /><span>I reviewed this exact recipient, subject, and message. I approve sending it now.</span></label>
        <Button disabled={!approved || dirty || pending !== null} className="mt-4 h-12 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]" onClick={() => void sendRequest()}>{pending === "send" ? <LoaderCircle className="animate-spin" /> : <Send />} Send this request</Button>
        <p className="send-boundary"><LockKeyhole /> No automatic outreach. This sends one approved email.</p>
      </> : <div className="sent-request"><span className="delivery-ring"><Send /></span><strong>{providerStatus?.status === "delivered" ? "Delivered" : providerStatus?.status === "sent" ? "Sent" : "Sending"}</strong><p>To {request.recipient}</p>{request.sentAt && <small>{formatDateTime(request.sentAt)}</small>}<details><summary>View the exact message</summary><h3>{request.subject}</h3><p className="whitespace-pre-wrap">{request.body}</p></details>{providerStatus?.errorMessage && <p className="form-error">{providerStatus.errorMessage}</p>}</div>}
    </section>
  );
}

function ContactBoundary() { return <section className="contact-boundary"><Mail /><div><strong>No message has been created yet.</strong><p>If a consequential gap remains, you’ll review the exact recipient and wording here.</p></div></section>; }

function Timeline({ events }: { events: Array<{ _id: string; label: string; occurredAt: number }> }) { return <section className="case-timeline"><p className="ink-label">Case record</p><ol>{events.slice(-8).reverse().map((event) => <li key={event._id}><span /><div><strong>{event.label}</strong><small>{formatDateTime(event.occurredAt)}</small></div></li>)}</ol></section>; }

function ReplyPanel({ reply }: { reply: { sender: string; subject: string; body: string; receivedAt: number } }) { return <section className="reply-panel"><div className="reply-heading"><span><Mail /></span><div><p className="ink-label">Real reply received</p><h2>{reply.subject || "Written response"}</h2><p>From {reply.sender} · {formatDateTime(reply.receivedAt)}</p></div></div><div className="reply-body">{reply.body}</div></section>; }

type ProofItem = { _id: string; verdict: string; requirementText: string; summary: string; conditions: string[]; sourceUrls: string[]; sourceExcerpts: string[] };

function ProofCard({ card, items, followUpAlreadyPrepared, checking, onCheck }: {
  card: { _id: Id<"proofCards">; basis: string; verdict: string; exactRequirement: string; summary: string; conditions: string[]; sourceUrls: string[]; sourceExcerpts: string[]; writtenMessage?: string; suggestedFollowUp?: string; recipient?: string; sentAt?: number; receivedAt?: number };
  items: ProofItem[];
  followUpAlreadyPrepared: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  const createFollowUp = useMutation(api.confirmations.createFollowUpDraft);
  const [followUpPending, setFollowUpPending] = useState(false);
  const [error, setError] = useState("");
  async function prepareFollowUp() {
    setFollowUpPending(true); setError("");
    try { await createFollowUp({ proofCardId: card._id }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The follow-up could not be prepared"); }
    finally { setFollowUpPending(false); }
  }
  return (
    <section className="proof-card ticket-shell" aria-labelledby="proof-card-title">
      <div className="proof-card-top"><div><p className="ink-label">Private Proof Card</p><h2 id="proof-card-title">{card.basis === "official_source" ? "Published by provider" : proofLabel(card.verdict)}</h2></div><span className="proof-seal"><ShieldCheck /><small>{card.basis === "written_reply" ? "WRITTEN REPLY" : "OFFICIAL SOURCE"}</small></span></div>
      <p className="proof-summary">{card.summary}</p>
      <div className="proof-items">{items.map((item, index) => <article key={item._id}><span>{String(index + 1).padStart(2, "0")}</span><div><p className="proof-item-verdict">{card.basis === "official_source" ? "Published by provider" : proofLabel(item.verdict)}</p><h3>{item.requirementText}</h3><p>{item.summary}</p>{item.conditions.length > 0 && <ul>{item.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul>}{item.sourceExcerpts.map((excerpt, excerptIndex) => <blockquote key={`${item._id}-${excerptIndex}`}>“{excerpt}”</blockquote>)}</div></article>)}</div>
      {card.writtenMessage && <details className="proof-message"><summary>Original written reply</summary><p>{card.writtenMessage}</p></details>}
      {card.suggestedFollowUp && <div className="followup-note"><strong>One follow-up may resolve what remains</strong><p>{card.suggestedFollowUp}</p>{error && <p role="alert" className="form-error">{error}</p>}<Button variant="outline" disabled={followUpPending || followUpAlreadyPrepared} onClick={() => void prepareFollowUp()}>{followUpPending ? <LoaderCircle className="animate-spin" /> : <Mail />}{followUpAlreadyPrepared ? "Follow-up already prepared" : "Prepare one follow-up"}</Button><small>Nothing is sent until you review and approve the exact message.</small></div>}
      <div className="proof-footer"><div><LockKeyhole /><span><strong>Private by default</strong><small>Original evidence remains preserved even if the source changes.</small></span></div><div>{card.recipient && <span>Recipient<br /><strong>{card.recipient}</strong></span>}{card.receivedAt && <span>Received<br /><strong>{formatDateTime(card.receivedAt)}</strong></span>}<Button variant="ghost" disabled={checking} onClick={onCheck}>{checking ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Check sources</Button></div></div>
    </section>
  );
}

function SourceChangeAlert({ change, pending, onAcknowledge }: {
  change: { _id: Id<"sourceChanges">; sourceUrl: string; previousExcerpt: string; currentExcerpt: string; detectedAt: number };
  pending: boolean;
  onAcknowledge: () => void;
}) {
  return (
    <section className="source-change-alert" role="alert">
      <div className="source-change-heading"><AlertTriangle /><div><strong>An official source changed</strong><p>Detected {formatDateTime(change.detectedAt)}. Your earlier evidence remains intact.</p></div></div>
      <div className="source-change-comparison"><div><span>Previously preserved</span><blockquote>“{change.previousExcerpt}”</blockquote></div><div><span>Current page</span><blockquote>“{change.currentExcerpt}”</blockquote></div></div>
      <div className="source-change-actions"><a href={change.sourceUrl} target="_blank" rel="noreferrer">Open current source <ArrowUpRight /></a><Button variant="outline" disabled={pending} onClick={onAcknowledge}>{pending ? <LoaderCircle className="animate-spin" /> : <Check />} Acknowledge</Button></div>
    </section>
  );
}

function proofLabel(verdict: string) {
  const labels: Record<string, string> = { confirmed: "Confirmed", confirmed_with_conditions: "Confirmed—with conditions", partially_confirmed: "Partially confirmed", not_confirmed: "Not confirmed", needs_followup: "Needs one follow-up", declined: "Confirmation declined" };
  return labels[verdict] ?? verdict;
}

function DecisionLoading() { return <div className="decision-loading" aria-live="polite"><LoaderCircle className="animate-spin" /><p>Opening the private case…</p></div>; }

function NotFound() { return <div className="not-found ticket-shell"><LockKeyhole /><h1>This private decision is not available.</h1><p>It may belong to a different account or no longer exist.</p><Button asChild><Link to="/app">Return to Promise Wallet <ChevronRight /></Link></Button></div>; }

function formatDateTime(value: number) { return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(value); }
