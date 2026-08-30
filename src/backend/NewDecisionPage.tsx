import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { ArrowLeft, ArrowRight, Link2, LoaderCircle, LockKeyhole, ShieldAlert } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewDecisionPage() {
  const createDecision = useMutation(api.decisions.create);
  const navigate = useNavigate();
  const [localDraft] = useState(readLocalDraft);
  const [sourceUrl, setSourceUrl] = useState(localDraft.sourceUrl);
  const [requirementText, setRequirementText] = useState(localDraft.requirementText);
  const [context, setContext] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    void createDecision({ sourceUrl, requirementText, ...(context.trim() ? { context } : {}) })
      .then((decisionId) => navigate(`/app/decisions/${decisionId}`))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "The decision could not be started"))
      .finally(() => setPending(false));
  }

  return (
    <div className="new-decision-page">
      <Link to="/app" className="back-link"><ArrowLeft /> Promise Wallet</Link>
      <header><p className="ink-label">New decision / 01</p><h1>What are you about<br /><em>to rely on?</em></h1><p>One official page. One exact requirement. We’ll show you what is written before anything is sent.</p></header>
      <form onSubmit={submit} className="new-decision-form ticket-shell">
        <section>
          <div className="form-step"><span>1</span><div><h2>Start with an official source</h2><p>Use the provider’s own website—not a review, search result, or social post.</p></div></div>
          <div className="input-with-icon mt-6"><Link2 /><Input aria-label="Official page" type="url" required autoComplete="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://official-site.com/page" /></div>
        </section>
        <section>
          <div className="form-step"><span>2</span><div><h2>State exactly what must be true</h2><p>This sentence becomes the boundary for every source and reply.</p></div></div>
          <Label htmlFor="new-requirement" className="sr-only">What must be true?</Label>
          <Textarea id="new-requirement" className="mt-6" required minLength={12} maxLength={800} rows={5} value={requirementText} onChange={(event) => setRequirementText(event.target.value)} placeholder="We need connecting rooms, not just adjacent rooms." />
          <span className="character-count">{requirementText.length}/800</span>
        </section>
        <section>
          <div className="form-step"><span>3</span><div><h2>Add context only if it changes the question</h2><p>Dates, quantities, or specific conditions can help keep the request scoped.</p></div></div>
          <Label htmlFor="new-context" className="sr-only">Optional context</Label>
          <Textarea id="new-context" className="mt-6" maxLength={1500} rows={3} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Optional: dates, model, location, or other decision context" />
        </section>
        {error && <p role="alert" className="form-error">{error}</p>}
        <Button type="submit" disabled={pending} className="h-14 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]">{pending ? <LoaderCircle className="animate-spin" /> : <ShieldAlert />} Build my reliance map <ArrowRight /></Button>
        <p className="send-boundary"><LockKeyhole /> This starts private research. It does not contact anyone.</p>
      </form>
      <aside className="scope-note"><strong>Designed for ordinary consumer decisions.</strong><p>Bookings, rentals, purchases, and services. Do not use it for medical, legal, financial, insurance, employment, or safety guarantees.</p></aside>
    </div>
  );
}

function readLocalDraft() {
  const empty = { sourceUrl: "", requirementText: "" };
  const raw = sessionStorage.getItem("giw:draft");
  if (!raw) return empty;
  sessionStorage.removeItem("giw:draft");
  try {
    const draft = JSON.parse(raw) as {
      sourceUrl?: unknown;
      requirementText?: unknown;
    };
    return {
      sourceUrl: typeof draft.sourceUrl === "string" ? draft.sourceUrl : "",
      requirementText:
        typeof draft.requirementText === "string" ? draft.requirementText : "",
    };
  } catch {
    return empty;
  }
}
