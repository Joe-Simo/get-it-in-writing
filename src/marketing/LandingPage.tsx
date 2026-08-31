import { useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  CircleCheck,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  MailQuestion,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Brand } from "@/components/Brand";
import { InkStage } from "@/visual/ink/InkStage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/lib/utils";

const decisionTypes = ["Hotel", "Apartment", "Venue", "Product", "Contractor", "Storage", "Rental"];


export default function LandingPage() {
  const reducedMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const probablyRef = useRef<HTMLElement>(null);
  const joinWaitlist = useMutation(api.waitlist.join);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function begin(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    void joinWaitlist({ email })
      .then(() => setJoined(true))
      .catch((reason: unknown) =>
        setError(errorText(reason, "That did not go through. Check the address and try again.")),
      )
      .finally(() => setPending(false));
  }

  return (
    <div className="min-h-screen overflow-hidden bg-paper text-ink">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="public-header">
        <Brand />
        <nav aria-label="Primary navigation" className="flex items-center gap-2">
          <a href="#how-it-works" className="hidden text-sm font-medium md:inline-flex">How it works</a>
          <Button asChild variant="outline" className="rounded-full bg-transparent">
            <Link to="/app">Sign in</Link>
          </Button>
        </nav>
      </header>

      <main id="main">
        <section className="hero-stage" ref={heroRef}>
          <InkStage hostRef={heroRef} emitterRef={probablyRef} />
          <motion.div
            className="hero-copy"
            initial={reducedMotion ? false : { y: 18 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="ink-label">Decision protection for everyday life</p>
            <h1>Don’t rely on<br /><em ref={probablyRef}>“probably.”</em></h1>
            <p className="hero-deck">
              Before you book, rent, buy, or hire, find out what the official page actually promises—and get the important gap confirmed in writing.
            </p>
            <div className="decision-type-row" aria-label="Works with these decisions">
              {decisionTypes.map((type) => <span key={type}>{type}</span>)}
            </div>
          </motion.div>

          <motion.form
            className="decision-intake ticket-shell"
            onSubmit={begin}
            initial={reducedMotion ? false : { y: 24, rotate: 0.4 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="ticket-number"><span>01</span><span>PRIVATE BETA</span></div>
            {joined ? (
              <div className="waitlist-joined" role="status">
                <CircleCheck aria-hidden="true" />
                <h2>You’re on the list.</h2>
                <p>We’ll write to you when your first case is ready to run — and only then.</p>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div>
                  <Label htmlFor="waitlist-email">Email</Label>
                  <p className="field-help">
                    Get It in Writing is in a private, judged beta. Leave your email and your
                    first case is on us when the doors open.
                  </p>
                  <Input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="mt-2 h-12"
                  />
                </div>
                {error && <p role="alert" className="form-error">{error}</p>}
                <Button type="submit" disabled={pending} className="h-13 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]">
                  {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
                  Join the waitlist <ArrowRight aria-hidden="true" />
                </Button>
                <p className="field-help">Judging the hackathon? Sign in with the demo wallet from the submission notes.</p>
              </div>
            )}
            <div className="intake-assurance">
              <LockKeyhole aria-hidden="true" />
              <span>Private by default. Nothing is sent without your approval — the waitlist uses your email once, to invite you.</span>
            </div>
          </motion.form>
        </section>

        <section id="how-it-works" className="method-section">
          <div className="method-heading">
            <p className="ink-label">One decision, made defensible</p>
            <h2>Know what’s written.<br />Fix what isn’t.</h2>
          </div>
          <div className="method-rail">
            <MethodStep number="01" icon={FileCheck2} title="Read the official source" copy="The page and relevant official policies are preserved with source links and capture details." />
            <MethodStep number="02" icon={ShieldCheck} title="See the reliance map" copy="Each need is checked separately for direct support, conditions, conflicts, scope mismatches, or missing language." />
            <MethodStep number="03" icon={MailQuestion} title="Ask only about the gap" copy="Review the exact recipient and message. You decide whether anything gets sent." />
            <MethodStep number="04" icon={Check} title="Keep the written answer" copy="The real reply and its conditions become a private, scoped Proof Card." />
          </div>
        </section>

        <section className="reliance-anatomy" aria-labelledby="reliance-heading">
          <div className="reliance-copy">
            <p className="ink-label">Not a summary. A boundary.</p>
            <h2 id="reliance-heading">The page can sound reassuring without promising the thing you need.</h2>
            <p>Get It in Writing marks the line between language you can point to and language you’re only hoping means yes.</p>
          </div>
          <div className="reliance-sheet ticket-shell">
            <p className="reliance-requirement">“We need connecting rooms, not just adjacent rooms.”</p>
            <RelianceRow tone="green" label="Published by provider" detail="Direct language from an official source appears here—with its citation." />
            <RelianceRow tone="amber" label="Conditional" detail="Availability, discretion, rate rules, or other conditions remain attached." />
            <RelianceRow tone="red" label="Conflicting information" detail="Both official passages remain visible. The disagreement is never smoothed over." />
            <RelianceRow tone="purple" label="Scope mismatch" detail="A promise for a different date, model, room, quantity, or location does not count." />
            <RelianceRow tone="gray" label="Not established" detail="No supporting promise is treated as no promise—not as a likely yes." />
            <p className="anatomy-note">Interface anatomy only. No claim is shown until a real source has been checked.</p>
          </div>
        </section>

        <section className="privacy-band">
          <div><LockKeyhole aria-hidden="true" /><p><strong>Your decision stays yours.</strong><br />Cases and Proof Cards are private by default.</p></div>
          <div><MailQuestion aria-hidden="true" /><p><strong>You control the contact.</strong><br />We never guess an email or send before approval.</p></div>
          <div><FileCheck2 aria-hidden="true" /><p><strong>Every answer stays scoped.</strong><br />A reply proves only what it actually says, under its stated conditions.</p></div>
        </section>
      </main>

      <footer className="public-footer">
        <Brand compact />
        <p>For ordinary bookings, purchases, rentals, and services. Not legal, medical, financial, insurance, employment, or safety advice.</p>
        <Button asChild className="rounded-full bg-ink text-paper hover:bg-ink/90"><Link to="/app/new">Protect a decision <ArrowRight /></Link></Button>
      </footer>
    </div>
  );
}

function MethodStep({ number, icon: Icon, title, copy }: { number: string; icon: typeof FileCheck2; title: string; copy: string }) {
  return (
    <article className="method-step">
      <span className="method-number">{number}</span>
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function RelianceRow({ tone, label, detail }: { tone: "green" | "amber" | "red" | "purple" | "gray"; label: string; detail: string }) {
  return (
    <div className={`reliance-row reliance-${tone}`}>
      <span className="reliance-dot" aria-hidden="true" />
      <div><strong>{label}</strong><p>{detail}</p></div>
      <ArrowRight aria-hidden="true" />
    </div>
  );
}
