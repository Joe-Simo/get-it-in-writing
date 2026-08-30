import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Clock3, FileCheck2, Inbox, LockKeyhole, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { PromiseSeal } from "@/components/PromiseSeal";
import { Button } from "@/components/ui/button";

type WalletFilter = "waiting" | "confirmed" | "reply";

const confirmedStatuses = new Set(["fully_established", "confirmed", "confirmed_with_conditions"]);
const replyStatuses = new Set(["reply_received", "interpreting_reply", "partially_confirmed", "not_confirmed", "needs_followup", "declined"]);

export default function DashboardPage() {
  const decisions = useQuery(api.decisions.listMine);
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<WalletFilter>("waiting");
  const counts = useMemo(() => {
    const rows = decisions ?? [];
    return {
      waiting: rows.filter((item) => !confirmedStatuses.has(item.status) && !replyStatuses.has(item.status)).length,
      confirmed: rows.filter((item) => confirmedStatuses.has(item.status)).length,
      reply: rows.filter((item) => replyStatuses.has(item.status)).length,
    };
  }, [decisions]);
  const visible = useMemo(() => (decisions ?? []).filter((item) => {
    if (filter === "confirmed") return confirmedStatuses.has(item.status);
    if (filter === "reply") return replyStatuses.has(item.status);
    return !confirmedStatuses.has(item.status) && !replyStatuses.has(item.status);
  }), [decisions, filter]);

  return (
    <div className="wallet-page">
      <header className="wallet-heading">
        <div><p className="ink-label">Promise Wallet</p><h1>Your decisions,<br /><em>with the uncertainty removed.</em></h1></div>
        <Button asChild className="h-12 rounded-full bg-cobalt px-6 text-white hover:bg-[#153ae8]"><Link to="/app/new"><Plus /> New decision</Link></Button>
      </header>

      <div className="wallet-tabs" role="tablist" aria-label="Filter decisions">
        <FilterTab active={filter === "waiting"} onClick={() => setFilter("waiting")} label="Waiting" count={counts.waiting} />
        <FilterTab active={filter === "confirmed"} onClick={() => setFilter("confirmed")} label="Confirmed" count={counts.confirmed} />
        <FilterTab active={filter === "reply"} onClick={() => setFilter("reply")} label="Reply received" count={counts.reply} />
      </div>

      {decisions === undefined ? <WalletLoading /> : visible.length === 0 ? (
        <motion.section
          className="empty-wallet ticket-shell"
          initial={reducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          aria-live="polite"
        >
          <PromiseSeal className="empty-seal" intensity={0.7} />
          <div className="empty-wallet-copy">
            <p className="ink-label">Private by default</p>
            <h2>{decisions.length === 0 ? "Nothing here yet." : `No ${filter === "reply" ? "replies" : filter} yet.`}</h2>
            <p>{decisions.length === 0 ? "Start with something you’re about to rely on." : "Your other decisions remain in their own wallet section."}</p>
            {decisions.length === 0 && <Button asChild className="mt-7 rounded-none bg-ink text-paper hover:bg-ink/90"><Link to="/app/new">Protect a decision <ArrowRight /></Link></Button>}
          </div>
          <div className="empty-wallet-steps">
            <span><FileCheck2 /> Paste an official page</span>
            <span><Clock3 /> State exactly what must be true</span>
            <span><Inbox /> Keep the written answer</span>
          </div>
          <p className="empty-private"><LockKeyhole /> Only you can see this wallet.</p>
        </motion.section>
      ) : (
        <section className="wallet-stack" aria-label={`${filter} decisions`}>
          {visible.map((decision, index) => (
            <motion.article
              key={decision._id}
              className="wallet-pass ticket-shell"
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : Math.min(index * 0.055, 0.28) }}
            >
              <div className="pass-index">{String(index + 1).padStart(2, "0")}</div>
              <div className="pass-main">
                <div className="flex flex-wrap items-center gap-2"><StatusStamp status={decision.status} />{decision.operationalFailure && <span className="failure-chip">Needs attention</span>}</div>
                <h2>{decision.title}</h2>
                <p className="pass-requirement">{decision.requirementText}</p>
              </div>
              <div className="pass-meta"><span>Official source</span><strong>{decision.sourceHost}</strong><span>Updated</span><strong>{formatDate(decision.updatedAt)}</strong></div>
              <Button asChild variant="ghost" className="pass-open"><Link to={`/app/decisions/${decision._id}`}>Open <ArrowRight /></Link></Button>
            </motion.article>
          ))}
        </section>
      )}
    </div>
  );
}

function FilterTab({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return <button type="button" role="tab" aria-selected={active} className={active ? "active" : ""} onClick={onClick}>{label}<span>{count}</span></button>;
}

function WalletLoading() {
  return <div className="wallet-loading" aria-live="polite"><span /><span /><span className="sr-only">Loading your decisions</span></div>;
}

export function StatusStamp({ status }: { status: string }) {
  const labels: Record<string, string> = {
    draft: "Draft", scoping: "Scoping", researching: "Reading official pages", analyzing: "Building reliance map",
    fully_established: "Established by source", confirmation_available: "Confirmation available", drafting_confirmation: "Drafting request",
    awaiting_approval: "Your approval needed", sending: "Sending", waiting: "Waiting for reply", reply_received: "Reply received",
    interpreting_reply: "Checking reply scope", confirmed: "Confirmed", confirmed_with_conditions: "Confirmed with conditions",
    partially_confirmed: "Partially confirmed", not_confirmed: "Not confirmed", needs_followup: "Needs follow-up", declined: "Declined",
  };
  const tone = confirmedStatuses.has(status) ? "green" : replyStatuses.has(status) ? "amber" : "blue";
  return <span className={`status-stamp status-${tone}`}>{labels[status] ?? status}</span>;
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(value);
}
