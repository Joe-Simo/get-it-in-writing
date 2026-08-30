import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  FileCheck2,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { StatusStamp } from "@/backend/DashboardPage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const terminalStatuses = new Set(["fully_established", "confirmed", "confirmed_with_conditions", "partially_confirmed", "not_confirmed", "needs_followup", "declined"]);

export default function DecisionPage() {
  const { decisionId } = useParams();
  const detail = useQuery(
    api.decisions.getDetail,
    decisionId ? { decisionId: decisionId as Id<"decisions"> } : "skip",
  );
  const retryResearch = useMutation(api.decisions.retryResearch);
  const request = detail?.requests[0];
  const [pending, setPending] = useState<"retry" | null>(null);
  const [error, setError] = useState("");
  const researchActive = detail ? ["scoping", "researching", "analyzing", "confirmation_available", "drafting_confirmation"].includes(detail.decision.status) : false;

  if (detail === undefined) return <DecisionLoading />;
  if (detail === null) return <NotFound />;
  const activeDecisionId = detail.decision._id;

  async function retry() {
    setPending("retry"); setError("");
    try { await retryResearch({ decisionId: activeDecisionId }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Research could not be restarted"); }
    finally { setPending(null); }
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

      {detail.decision.operationalFailure && (
        <section className="operational-error" role="alert">
          <CircleAlert /><div><strong>The product stopped safely.</strong><p>{detail.decision.operationalMessage}</p></div>
          {(["research_failed", "analysis_failed"] as string[]).includes(detail.decision.operationalFailure) && <Button variant="outline" disabled={pending !== null} onClick={() => void retry()}>{pending === "retry" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Retry research</Button>}
        </section>
      )}
      {error && <p role="alert" className="form-error mb-5">{error}</p>}

      <section className="exact-requirement ticket-shell">
        <div className="ticket-number"><span>REQUIREMENT</span><span>THE DECISION BOUNDARY</span></div>
        <blockquote>{detail.decision.requirementText}</blockquote>
        {detail.decision.context && <p><strong>Context:</strong> {detail.decision.context}</p>}
      </section>

      <div className="decision-grid">
        <section className="reliance-map-panel">
          <div className="section-heading"><div><p className="ink-label">Reliance map</p><h2>What the official web establishes</h2></div><span>{detail.assessments.length || (researchActive ? "…" : 0)}</span></div>
          {researchActive && detail.assessments.length === 0 ? <ResearchInProgress status={detail.decision.status} sourceHost={detail.decision.sourceHost} /> : detail.assessments.length === 0 ? <p className="panel-empty">No reliance map is available yet.</p> : (
            <div className="assessment-list">
              {detail.assessments.map((assessment) => <Assessment key={assessment._id} assessment={assessment} />)}
            </div>
          )}
          {detail.sources.length > 0 && (
            <details className="source-register"><summary>Source register <span>{detail.sources.length}</span></summary><ol>{detail.sources.map((source) => <li key={source._id}><a href={source.url} target="_blank" rel="noreferrer">{source.title ?? new URL(source.url).hostname}<ArrowUpRight /></a><small>Captured {formatDateTime(source.capturedAt)} · SHA-256 {source.contentHash.slice(0, 12)}…</small></li>)}</ol></details>
          )}
        </section>

        <aside className="case-side">
          {request ? (
            <ConfirmationPanel
              key={request._id}
              request={request}
              contacts={detail.contacts}
            />
          ) : terminalStatuses.has(detail.decision.status) ? null : <ContactBoundary />}
          <Timeline events={detail.events} />
        </aside>
      </div>

      {detail.replies.length > 0 && <ReplyPanel reply={detail.replies[0]} />}
      {detail.proofCard && <ProofCard card={detail.proofCard} />}
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

function ResearchInProgress({ status, sourceHost }: { status: string; sourceHost: string }) {
  const copy = status === "analyzing" ? "Checking every supportive claim against its exact source passage…" : `Reading ${sourceHost} and its relevant official pages…`;
  return <div className="research-progress" aria-live="polite"><LoaderCircle className="animate-spin" /><div><strong>{status === "analyzing" ? "Building the reliance map" : "Research in progress"}</strong><p>{copy}</p><small>Nothing is being sent.</small></div></div>;
}

function Assessment({ assessment }: { assessment: { _id: string; status: string; statement: string; reason: string; sourceUrl?: string; sourceTitle?: string; sourceExcerpt?: string } }) {
  const labels: Record<string, string> = { established: "Established", vague_or_conditional: "Vague or conditional", not_established: "Not established" };
  return <article className={`assessment assessment-${assessment.status}`}><div className="assessment-status"><span />{labels[assessment.status]}</div><h3>{assessment.statement}</h3><p>{assessment.reason}</p>{assessment.sourceExcerpt && <blockquote>“{assessment.sourceExcerpt}”</blockquote>}{assessment.sourceUrl && <a href={assessment.sourceUrl} target="_blank" rel="noreferrer">{assessment.sourceTitle ?? "Open official source"}<ArrowUpRight /></a>}</article>;
}

type ConfirmationPanelProps = {
  request: { _id: Id<"confirmationRequests">; status: string; recipient?: string; recipientSource: string; subject: string; body: string; sentAt?: number; outboundId?: string };
  contacts: Array<{ _id: Id<"officialContacts">; email: string; label: string; sourceUrl: string }>;
};

function ConfirmationPanel({ request, contacts }: ConfirmationPanelProps) {
  const saveDraft = useMutation(api.confirmations.saveDraft);
  const approveAndSend = useMutation(api.confirmations.approveAndSend);
  const providerStatus = useQuery(
    api.confirmations.sendStatus,
    request.outboundId ? { requestId: request._id } : "skip",
  );
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

  function markEdited() {
    setDirty(true);
    setApproved(false);
    setNotice("");
  }

  async function save() {
    const selectedContactId = contactChoice === "manual"
      ? undefined
      : contactChoice as Id<"officialContacts">;
    setPending("save");
    setError("");
    setNotice("");
    try {
      await saveDraft({
        requestId: request._id,
        recipient,
        ...(selectedContactId ? { contactId: selectedContactId } : {}),
        subject,
        body,
      });
      setDirty(false);
      setApproved(false);
      setNotice("Saved. Now review this exact recipient and message before approving it.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The draft could not be saved");
    } finally {
      setPending(null);
    }
  }

  async function sendRequest() {
    if (dirty) {
      setError("Save the exact draft before approving it.");
      return;
    }
    setPending("send");
    setError("");
    setNotice("");
    try {
      await approveAndSend({
        requestId: request._id,
        approvedExactRecipientAndMessage: true,
      });
      setApproved(false);
      setNotice("Your approved request is being sent. Delivery and real replies will update this case.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be sent");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="confirmation-panel ticket-shell">
      <div className="section-heading compact"><div><p className="ink-label">Written confirmation</p><h2>{editable ? "Review the exact request" : "Request sent"}</h2></div><Mail /></div>
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

function ContactBoundary() {
  return <section className="contact-boundary"><Mail /><div><strong>No message has been created yet.</strong><p>Once the reliance map finds a consequential gap, you’ll review the recipient and wording here.</p></div></section>;
}

function Timeline({ events }: { events: Array<{ _id: string; label: string; occurredAt: number }> }) {
  return <section className="case-timeline"><p className="ink-label">Case record</p><ol>{events.slice(-8).reverse().map((event) => <li key={event._id}><span /><div><strong>{event.label}</strong><small>{formatDateTime(event.occurredAt)}</small></div></li>)}</ol></section>;
}

function ReplyPanel({ reply }: { reply: { sender: string; subject: string; body: string; receivedAt: number } }) {
  return <section className="reply-panel"><div className="reply-heading"><span><Mail /></span><div><p className="ink-label">Real reply received</p><h2>{reply.subject || "Written response"}</h2><p>From {reply.sender} · {formatDateTime(reply.receivedAt)}</p></div></div><div className="reply-body">{reply.body}</div></section>;
}

function ProofCard({ card }: { card: { basis: string; verdict: string; exactRequirement: string; summary: string; conditions: string[]; sourceUrls: string[]; sourceExcerpts: string[]; writtenMessage?: string; suggestedFollowUp?: string; recipient?: string; sentAt?: number; receivedAt?: number } }) {
  return (
    <section className="proof-card ticket-shell" aria-labelledby="proof-card-title">
      <div className="proof-card-top"><div><p className="ink-label">Private Proof Card</p><h2 id="proof-card-title">{proofLabel(card.verdict)}</h2></div><span className="proof-seal"><ShieldCheck /><small>{card.basis === "written_reply" ? "WRITTEN REPLY" : "OFFICIAL SOURCE"}</small></span></div>
      <div className="proof-requirement"><span>Exact requirement</span><blockquote>{card.exactRequirement}</blockquote></div>
      <div className="proof-grid"><div><span>Scoped result</span><p>{card.summary}</p></div><div><span>Conditions</span>{card.conditions.length ? <ul>{card.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : <p>No additional conditions were stated.</p>}</div></div>
      {card.sourceExcerpts.length > 0 && <div className="proof-evidence"><span>Preserved evidence</span>{card.sourceExcerpts.map((excerpt, index) => <blockquote key={`${excerpt}-${index}`}>“{excerpt}”</blockquote>)}</div>}
      {card.writtenMessage && <details className="proof-message"><summary>Original written reply</summary><p>{card.writtenMessage}</p></details>}
      {card.suggestedFollowUp && <div className="followup-note"><strong>One suggested follow-up</strong><p>{card.suggestedFollowUp}</p><small>Nothing will be sent automatically.</small></div>}
      <div className="proof-footer"><div><LockKeyhole /><span><strong>Private by default</strong><small>Share only what you choose, when you choose.</small></span></div><div>{card.recipient && <span>Recipient<br /><strong>{card.recipient}</strong></span>}{card.receivedAt && <span>Received<br /><strong>{formatDateTime(card.receivedAt)}</strong></span>}</div></div>
    </section>
  );
}

function proofLabel(verdict: string) {
  const labels: Record<string, string> = { confirmed: "Confirmed", confirmed_with_conditions: "Confirmed—with conditions", partially_confirmed: "Partially confirmed", not_confirmed: "Not confirmed", needs_followup: "Needs one follow-up", declined: "Confirmation declined" };
  return labels[verdict] ?? verdict;
}

function DecisionLoading() {
  return <div className="decision-loading" aria-live="polite"><LoaderCircle className="animate-spin" /><p>Opening the private case…</p></div>;
}

function NotFound() {
  return <div className="not-found ticket-shell"><LockKeyhole /><h1>This private decision is not available.</h1><p>It may belong to a different account or no longer exist.</p><Button asChild><Link to="/app">Return to Promise Wallet <ChevronRight /></Link></Button></div>;
}

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(value);
}
