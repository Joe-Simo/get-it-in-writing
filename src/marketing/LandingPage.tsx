import { useState } from "react";
import { useAction } from "convex/react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  MailCheck,
  Menu,
  MousePointer2,
  Route,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const featuredReportSlug = import.meta.env.VITE_FEATURED_REPORT_SLUG as
  | string
  | undefined ?? "setup-request-to-confirmation-cd8df1tc";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f3efe6] text-[#111612]">
      <a href="#content" className="skip-link">Skip to content</a>
      <Header />
      <main id="content">
        <Hero />
        <Handoffs />
        <IncidentSection />
        <ForEveryBusiness />
        <ProofSection />
        <FinalCall />
      </main>
      <footer className="border-t border-black/20 px-5 py-8 md:px-8 lg:px-12">
        <div className="flex flex-col justify-between gap-3 text-xs text-black/65 sm:flex-row">
          <p>© 2026 Signal Garden. Customer journeys, checked end to end.</p>
          <div className="flex gap-5">
            <a href="#how-it-works" className="hover:text-black">How it works</a>
            <Link to="/app" className="hover:text-black">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  const links = (
    <>
      <a href="#how-it-works" className="text-sm hover:opacity-60">How it works</a>
      <a href="#incidents" className="text-sm hover:opacity-60">Incidents</a>
      <a href="#proof" className="text-sm hover:opacity-60">Proof</a>
    </>
  );
  return (
    <header className="sticky top-0 z-40 flex h-[70px] items-center justify-between border-b border-black/20 bg-[#f3efe6]/95 px-5 backdrop-blur md:px-8 lg:px-12">
      <Link to="/" className="flex items-center gap-2 font-semibold tracking-[-.02em]">
        <span className="grid size-6 place-items-center rounded-full bg-[#111612] text-[9px] text-[#c8ff53]">SG</span>
        Signal Garden
      </Link>
      <nav className="hidden items-center gap-7 md:flex" aria-label="Primary navigation">{links}</nav>
      <div className="hidden items-center gap-2 md:flex">
        <Button asChild variant="ghost" size="sm"><Link to="/app">Sign in</Link></Button>
        <Button asChild size="sm" className="rounded-full bg-[#111612] px-5 text-[#f3efe6]"><a href="#check">Check my website</a></Button>
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu /></Button>
        </SheetTrigger>
        <SheetContent className="bg-[#f3efe6] p-7">
          <nav className="mt-16 flex flex-col gap-6" aria-label="Mobile navigation">
            {links}
            <Button asChild className="mt-4 rounded-full"><Link to="/app">Open Signal Garden</Link></Button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-black/20 px-5 py-7 md:px-8 lg:px-12 lg:py-10">
      <div className="grid min-h-[690px] border-l border-t border-black/20 lg:grid-cols-[1.06fr_.94fr]">
        <div className="flex flex-col justify-between border-b border-r border-black/20 p-6 md:p-9 lg:p-12">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-full border-black/30 bg-transparent px-3 py-1 text-[10px] uppercase tracking-[.19em]">Always-on mystery shopper</Badge>
              <span className="text-xs text-black/65">For businesses that win customers online</span>
            </div>
            <h1 className="mt-10 max-w-5xl text-[clamp(4.2rem,8vw,8.7rem)] font-semibold leading-[.78] tracking-[-.082em]">
              Know when your
              <span className="block font-editorial font-normal italic tracking-[-.06em]">customer journey breaks.</span>
            </h1>
            <p className="mt-10 max-w-2xl text-balance text-xl leading-[1.38] tracking-[-.025em] text-black/72 md:text-2xl">
              Signal Garden checks your website like a real customer—forms,
              confirmations, and replies—then shows exactly where a lead got lost.
            </p>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-12 rounded-full bg-[#111612] px-6 text-[#f3efe6] hover:bg-[#29332b]"><a href="#check">Check my website <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-black/30 bg-transparent px-6"><a href="#how-it-works">See what gets checked</a></Button>
          </div>
        </div>
        <JourneyContract />
      </div>
    </section>
  );
}

function JourneyContract() {
  const steps = [
    { icon: MousePointer2, label: "Website", title: "Can a customer reach the right page?", detail: "Public path opened and checked in a real browser." },
    { icon: Route, label: "Request", title: "Can they finish the form?", detail: "A clearly labeled QA request verifies the actual handoff." },
    { icon: MailCheck, label: "Confirmation", title: "Do they know it worked?", detail: "The test-customer inbox waits for the promised acknowledgement." },
    { icon: Clock3, label: "Reply", title: "Does someone follow up on time?", detail: "The response clock stops only when the reply really arrives." },
  ];
  return (
    <div className="border-b border-r border-black/20 bg-[#0b0e0c] p-5 text-[#f3efe6] md:p-8 lg:p-10">
      <div className="flex items-center justify-between border-b border-white/15 pb-5">
        <div><p className="eyebrow text-[#c8ff53]">Journey contract</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">Quote request → reply</h2></div>
        <span className="flex items-center gap-2 text-xs text-white/65"><span className="size-2 rounded-full bg-[#c8ff53]" /> End to end</span>
      </div>
      <div className="mt-7">
        {steps.map(({ icon: Icon, label, title, detail }, index) => (
          <article key={label} className="grid grid-cols-[42px_1fr] gap-4 border-b border-white/15 py-5 last:border-b-0">
            <div className="relative">
              <span className="grid size-9 place-items-center rounded-full border border-white/20 bg-white/[.04]"><Icon className="size-4 text-[#c8ff53]" /></span>
              {index < steps.length - 1 && <span className="absolute left-[18px] top-9 h-[22px] w-px bg-white/15" />}
            </div>
            <div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">{label}</p><h3 className="mt-1 text-lg font-semibold tracking-[-.025em]">{title}</h3><p className="mt-1 text-sm leading-relaxed text-white/65">{detail}</p></div>
          </article>
        ))}
      </div>
      <div className="mt-5 border border-[#ff7c68]/60 bg-[#ff7c68]/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#ffab9e]"><CircleAlert className="size-4" /> When one handoff fails, the owner gets the evidence—not a vague uptime alert.</div>
      </div>
    </div>
  );
}

function Handoffs() {
  const items = [
    { index: "01", title: "Map the journey", body: "Enter the website. Signal Garden finds the visible lead and contact paths worth protecting, then you choose the one that matters." },
    { index: "02", title: "Approve the exact check", body: "Review the page, customer goal, reply promise, and schedule. Nothing submits until an owner confirms they are authorized to test it." },
    { index: "03", title: "Watch every handoff", body: "A clearly identified test customer completes the public request. The same run waits for confirmation and the promised human response." },
    { index: "04", title: "Fix what customers feel", body: "Incidents name the broken step, preserve the evidence, assign an owner, and close only after the next real journey succeeds." },
  ];
  return (
    <section id="how-it-works" className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[.68fr_1.32fr]">
        <div>
          <p className="eyebrow">One journey, every handoff / 01</p>
          <h2 className="mt-5 max-w-xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">Uptime is not the same as a working business.</h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-black/65">A page can be online while the form fails, the confirmation never arrives, or the lead sits unanswered. Signal Garden checks the outcome a customer actually experiences.</p>
        </div>
        <div className="border-l border-t border-black/20">
          {items.map((item) => (
            <article key={item.index} className="grid min-h-40 grid-cols-[64px_1fr] border-b border-r border-black/20">
              <div className="flex flex-col items-center justify-between border-r border-black/20 py-5"><span className="font-mono text-xs text-[#4f7134]">{item.index}</span><Check className="size-4 text-[#4f7134]" /></div>
              <div className="p-5 md:p-7"><h3 className="text-2xl font-semibold tracking-[-.035em]">{item.title}</h3><p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/65">{item.body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function IncidentSection() {
  return (
    <section id="incidents" className="border-y border-black/20 bg-[#0b0e0c] px-5 py-20 text-[#f3efe6] md:px-8 lg:px-12 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
        <div><p className="eyebrow text-[#c8ff53]">A customer is waiting / 02</p><h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">The alert says what broke—and what it cost the journey.</h2><p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">No charts full of server jargon. You see the last successful step, the missed promise, the elapsed time, and the evidence your team needs to act.</p></div>
        <div className="border border-white/18 bg-white/[.025]">
          <div className="flex items-center justify-between border-b border-white/15 p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#ff7c68]/15 text-[#ff9a8a]"><CircleAlert className="size-4" /></span><div><p className="text-sm font-semibold">Customer is still waiting</p><p className="text-xs text-white/65">Quote request journey</p></div></div><Badge className="bg-[#ff7c68] text-[#1b0d0b]">Needs owner</Badge></div>
          <div className="grid gap-px bg-white/15 sm:grid-cols-3">
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Last verified</p><p className="mt-3 text-lg font-semibold">Confirmation email</p></div>
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Promise</p><p className="mt-3 text-lg font-semibold">Reply within 24h</p></div>
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Action</p><p className="mt-3 text-lg font-semibold">Assign + rerun</p></div>
          </div>
          <div className="p-5 text-sm leading-relaxed text-white/65">The public control room uses the same evidence model after a real run. It does not publish customer details, inbox addresses, or form contents.</div>
        </div>
      </div>
    </section>
  );
}

function ForEveryBusiness() {
  const businesses = [
    ["Home services", "Protect quote requests after hours and on weekends."],
    ["Agencies", "Know whether new-business inquiries reach the right person."],
    ["Consultants", "Verify contact forms and promised response times."],
    ["B2B teams", "Catch broken demo and sales-interest handoffs."],
  ];
  return (
    <section className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="eyebrow">Built around a business promise / 03</p><h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">If a website creates leads, there is a journey worth protecting.</h2></div><p className="max-w-md text-sm leading-relaxed text-black/65">Start with the single path closest to revenue. Add another only when the first one is producing useful operational evidence.</p></div>
      <div className="mt-12 grid gap-px border border-black/20 bg-black/20 md:grid-cols-2 xl:grid-cols-4">
        {businesses.map(([title, body], index) => <article key={title} className="min-h-52 bg-[#f3efe6] p-6"><span className="font-mono text-xs text-[#4f7134]">0{index + 1}</span><h3 className="mt-14 text-2xl font-semibold tracking-[-.035em]">{title}</h3><p className="mt-3 text-sm leading-relaxed text-black/65">{body}</p></article>)}
      </div>
    </section>
  );
}

function ProofSection() {
  return (
    <section id="proof" className="border-y border-black/20 bg-[#ded9ce] px-5 py-20 md:px-8 lg:px-12 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
        <div><p className="eyebrow">Public proof / 04</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em]">Trust the run, not a sales claim.</h2></div>
        <div className="border border-black/20 bg-[#f3efe6] p-6 md:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-[#4f7134]" /><p className="font-semibold">A public report contains only customer-safe evidence.</p></div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/65">Owners can share the current journey result and checkpoint history without exposing form contents, customer data, inbox addresses, or private team notes.</p>
          {featuredReportSlug ? <Button asChild variant="outline" className="mt-6 rounded-full bg-transparent"><Link to={`/proof/${featuredReportSlug}`}>Inspect the latest real run <ExternalLink /></Link></Button> : <p className="mt-6 inline-flex items-center gap-2 border border-black/20 px-4 py-2 text-xs text-black/65"><span className="size-2 rounded-full bg-[#4f7134]" /> The first owner-authorized run will appear here.</p>}
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section id="check" className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="grid border border-black/20 lg:grid-cols-[.9fr_1.1fr]">
        <div className="border-b border-black/20 p-6 md:p-9 lg:border-b-0 lg:border-r lg:p-12"><p className="eyebrow">Find the first journey</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">Check what happens after a customer clicks.</h2><p className="mt-6 max-w-lg text-base leading-relaxed text-black/65">Enter the public website and a work email. We’ll send a private setup link. No form is tested until you review the exact path and authorize it.</p></div>
        <AuditRequestForm />
      </div>
    </section>
  );
}

function AuditRequestForm() {
  const requestAudit = useAction(api.intakeActions.requestAudit);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (status === "sent") {
    return <div className="grid min-h-[420px] place-items-center bg-[#0b0e0c] p-8 text-[#f3efe6]"><div className="max-w-md text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#c8ff53] text-[#111612]"><MailCheck /></span><h3 className="mt-6 text-4xl font-semibold tracking-[-.05em]">Check your inbox.</h3><p className="mt-4 text-sm leading-relaxed text-white/65">Your private setup link is on the way. The website will not be tested until you sign in and authorize the journey.</p></div></div>;
  }
  return (
    <form className="flex min-h-[420px] flex-col justify-center bg-[#0b0e0c] p-6 text-[#f3efe6] md:p-10 lg:p-12" onSubmit={(event) => { event.preventDefault(); setStatus("sending"); setError(""); void requestAudit({ websiteUrl, email }).then(() => setStatus("sent")).catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : "The setup link could not be sent"); setStatus("idle"); }); }}>
      <div><Label htmlFor="audit-website" className="text-white/65">Business website</Label><Input id="audit-website" type="url" inputMode="url" placeholder="https://yourbusiness.com" required value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="mt-2 h-14 border-white/22 bg-white/[.04] px-4 text-base text-white placeholder:text-white/65" /></div>
      <div className="mt-5"><Label htmlFor="audit-email" className="text-white/65">Work email</Label><Input id="audit-email" type="email" autoComplete="email" placeholder="you@company.com" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-14 border-white/22 bg-white/[.04] px-4 text-base text-white placeholder:text-white/65" /></div>
      {error && <p role="alert" className="mt-4 text-sm text-[#ff9a8a]">{error}</p>}
      <Button type="submit" disabled={status === "sending"} className="mt-7 h-13 rounded-full bg-[#c8ff53] text-[#111612] hover:bg-[#d6ff7b]">{status === "sending" ? "Sending private link…" : "Find my customer journey"}{status !== "sending" && <ArrowRight />}</Button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-white/65">Public websites only. No scan or form submission starts from this request.</p>
    </form>
  );
}
