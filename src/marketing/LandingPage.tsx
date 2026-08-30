import { useState, type FormEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  Check,
  FileCheck2,
  Link2,
  LockKeyhole,
  MailQuestion,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { PromiseSeal } from "@/components/PromiseSeal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const decisionTypes = ["Hotel", "Apartment", "Venue", "Product", "Contractor", "Storage", "Rental"];

export default function LandingPage() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [sourceUrl, setSourceUrl] = useState("");
  const [requirementText, setRequirementText] = useState("");

  function begin(event: FormEvent) {
    event.preventDefault();
    sessionStorage.setItem(
      "giw:draft",
      JSON.stringify({ sourceUrl: sourceUrl.trim(), requirementText: requirementText.trim() }),
    );
    void navigate("/app/new");
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
        <section className="hero-stage">
          <PromiseSeal className="hero-seal" intensity={0.86} />
          <motion.div
            className="hero-copy"
            initial={reducedMotion ? false : { y: 18 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="ink-label">Decision protection for everyday life</p>
            <h1>Don’t rely on<br /><em>“probably.”</em></h1>
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
            <div className="ticket-number"><span>01</span><span>START A DECISION</span></div>
            <div className="space-y-6">
              <div>
                <Label htmlFor="source-url">Official page</Label>
                <p className="field-help">Paste the page you’re about to rely on.</p>
                <div className="input-with-icon">
                  <Link2 aria-hidden="true" />
                  <Input
                    id="source-url"
                    type="url"
                    required
                    value={sourceUrl}
                    onChange={(event) => setSourceUrl(event.target.value)}
                    placeholder="https://official-site.com/page"
                    autoComplete="url"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="requirement">What must be true?</Label>
                <p className="field-help">Say the exact thing that would change your decision.</p>
                <Textarea
                  id="requirement"
                  required
                  minLength={12}
                  maxLength={800}
                  value={requirementText}
                  onChange={(event) => setRequirementText(event.target.value)}
                  placeholder="We need connecting rooms, not just adjacent rooms."
                  rows={4}
                />
                <span className="character-count">{requirementText.length}/800</span>
              </div>
            </div>
            <Button type="submit" className="mt-8 h-13 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]">
              Check before I rely on it <ArrowRight aria-hidden="true" />
            </Button>
            <div className="intake-assurance">
              <LockKeyhole aria-hidden="true" />
              <span>Private by default. Nothing is sent without your approval.</span>
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
            <MethodStep number="02" icon={ShieldCheck} title="See the reliance map" copy="Your exact requirement is separated into established, vague or conditional, and not established." />
            <MethodStep number="03" icon={MailQuestion} title="Ask only about the gap" copy="Review the exact recipient and message. You decide whether anything gets sent." />
            <MethodStep number="04" icon={Check} title="Keep the written answer" copy="The real reply and its conditions become a private, scoped Proof Card." />
          </div>
        </section>

        <section className="reliance-demo" aria-labelledby="reliance-heading">
          <div className="reliance-copy">
            <p className="ink-label">Not a summary. A boundary.</p>
            <h2 id="reliance-heading">The page can sound reassuring without promising the thing you need.</h2>
            <p>Get It in Writing marks the line between language you can point to and language you’re only hoping means yes.</p>
          </div>
          <div className="reliance-sheet ticket-shell">
            <p className="reliance-requirement">“We need connecting rooms, not just adjacent rooms.”</p>
            <RelianceRow tone="green" label="Established" detail="Direct language from an official source appears here—with its citation." />
            <RelianceRow tone="amber" label="Vague or conditional" detail="Related wording with availability, discretion, or unclear terms is kept separate." />
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

function RelianceRow({ tone, label, detail }: { tone: "green" | "amber" | "gray"; label: string; detail: string }) {
  return (
    <div className={`reliance-row reliance-${tone}`}>
      <span className="reliance-dot" aria-hidden="true" />
      <div><strong>{label}</strong><p>{detail}</p></div>
      <ArrowRight aria-hidden="true" />
    </div>
  );
}
