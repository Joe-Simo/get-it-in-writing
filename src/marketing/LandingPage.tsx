import { useState } from "react";
import { useAction } from "convex/react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleAlert,
  ExternalLink,
  Globe2,
  MailCheck,
  Menu,
  MousePointer2,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
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
        <HowItWorks />
        <AlertSection />
        <ForEveryBusiness />
        <ProofSection />
        <PrivateBeta />
        <FinalCall />
      </main>
      <footer className="border-t border-black/20 px-5 py-8 md:px-8 lg:px-12">
        <div className="flex flex-col justify-between gap-3 text-xs text-black/65 sm:flex-row">
          <p>© 2026 Signal Garden. Daily lead-form monitoring.</p>
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
      <a href="#checks" className="text-sm hover:opacity-60">What we check</a>
      <a href="#proof" className="text-sm hover:opacity-60">Real proof</a>
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
        <Button asChild size="sm" className="rounded-full bg-[#111612] px-5 text-[#f3efe6]"><a href="#check">Check my lead form</a></Button>
      </div>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu /></Button>
        </SheetTrigger>
        <SheetContent className="bg-[#f3efe6] p-7">
          <nav className="mt-16 flex flex-col gap-6" aria-label="Mobile navigation">
            {links}
            <Button asChild className="mt-4 rounded-full"><a href="#check">Check my lead form</a></Button>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function Hero() {
  return (
    <section className="border-b border-black/20 px-5 py-7 md:px-8 lg:px-12 lg:py-10">
      <div className="grid min-h-[690px] border-l border-t border-black/20 lg:grid-cols-[1.08fr_.92fr]">
        <div className="flex flex-col justify-between border-b border-r border-black/20 p-6 md:p-9 lg:p-12">
          <div>
            <p className="max-w-xl text-sm font-medium text-black/60">Daily monitoring for the website form that brings you business.</p>
            <h1 className="mt-10 max-w-5xl text-[clamp(4rem,8vw,8.4rem)] font-semibold leading-[.8] tracking-[-.082em]">
              We test your lead form every day.
              <span className="mt-3 block font-editorial font-normal italic tracking-[-.06em]">If it breaks, we email you.</span>
            </h1>
            <p className="mt-10 max-w-2xl text-balance text-xl leading-[1.38] tracking-[-.025em] text-black/72 md:text-2xl">
              Signal Garden sends one clearly labeled test lead, checks what the visitor sees, and waits for the confirmation email when your site promises one.
            </p>
          </div>
          <div className="mt-12">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 rounded-full bg-[#111612] px-6 text-[#f3efe6] hover:bg-[#29332b]"><a href="#check">Check my lead form <ArrowRight /></a></Button>
              <Button asChild size="lg" variant="outline" className="h-12 rounded-full border-black/30 bg-transparent px-6"><a href="#proof">See a real check</a></Button>
            </div>
            <p className="mt-4 text-xs text-black/55">Free private beta. No card required.</p>
          </div>
        </div>
        <DailyCheckCard />
      </div>
    </section>
  );
}

function DailyCheckCard() {
  const steps = [
    { icon: Globe2, title: "Website opens", detail: "The public form page loads for a real visitor." },
    { icon: MousePointer2, title: "Form accepts a test lead", detail: "A clearly labeled QA submission completes safely." },
    { icon: MailCheck, title: "Confirmation arrives", detail: "The expected acknowledgement reaches the test inbox." },
    { icon: CircleAlert, title: "Owner gets emailed if anything fails", detail: "The alert names the broken step and opens the check details." },
  ];
  return (
    <div id="checks" className="border-b border-r border-black/20 bg-[#0b0e0c] p-5 text-[#f3efe6] md:p-8 lg:p-10">
      <div className="flex items-center justify-between border-b border-white/15 pb-5">
        <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#c8ff53]">Daily lead-form check</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.04em]">One real test. Every day.</h2></div>
        <span className="font-mono text-xs text-white/55">1 check / day</span>
      </div>
      <div className="mt-7">
        {steps.map(({ icon: Icon, title, detail }, index) => (
          <article key={title} className="grid grid-cols-[42px_1fr] gap-4 border-b border-white/15 py-5 last:border-b-0">
            <div className="relative">
              <span className="grid size-9 place-items-center rounded-full border border-white/20 bg-white/[.04]"><Icon className="size-4 text-[#c8ff53]" /></span>
              {index < steps.length - 1 && <span className="absolute left-[18px] top-9 h-[22px] w-px bg-white/15" />}
            </div>
            <div><h3 className="text-lg font-semibold tracking-[-.025em]">{title}</h3><p className="mt-1 text-sm leading-relaxed text-white/65">{detail}</p></div>
          </article>
        ))}
      </div>
      <div className="mt-5 border border-[#c8ff53]/40 bg-[#c8ff53]/8 p-4 text-sm font-semibold text-[#d7ff82]">One failure → one clear email</div>
    </div>
  );
}

function HowItWorks() {
  const items = [
    { index: "01", title: "Add your website", body: "Signal Garden finds the public contact, quote, or demo form closest to a new customer." },
    { index: "02", title: "Approve the form", body: "Review the exact page and test. Nothing is submitted until an owner confirms permission." },
    { index: "03", title: "Get emailed if it breaks", body: "A daily check verifies the page, submission, and expected confirmation. The email names the broken step and opens the check details." },
  ];
  return (
    <section id="how-it-works" className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[.68fr_1.32fr]">
        <div>
          <p className="eyebrow">The problem / 01</p>
          <h2 className="mt-5 max-w-xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">Your website can be online and still lose every lead.</h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-black/65">Uptime checks only prove a page responds. They do not prove a visitor can submit the form or receive the promised confirmation.</p>
        </div>
        <div className="border-l border-t border-black/20">
          {items.map((item) => (
            <article key={item.index} className="grid min-h-44 grid-cols-[64px_1fr] border-b border-r border-black/20">
              <div className="flex flex-col items-center justify-between border-r border-black/20 py-5"><span className="font-mono text-xs text-[#4f7134]">{item.index}</span><Check className="size-4 text-[#4f7134]" /></div>
              <div className="p-5 md:p-7"><h3 className="text-2xl font-semibold tracking-[-.035em]">{item.title}</h3><p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/65">{item.body}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AlertSection() {
  return (
    <section className="border-y border-black/20 bg-[#0b0e0c] px-5 py-20 text-[#f3efe6] md:px-8 lg:px-12 lg:py-28">
      <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
        <div><p className="eyebrow text-[#c8ff53]">The alert / 02</p><h2 className="mt-5 max-w-3xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">The email tells you what failed.</h2><p className="mt-6 max-w-xl text-lg leading-relaxed text-white/65">No server jargon. Open the message, see the broken step, review what happened, and rerun the check after the fix.</p></div>
        <div className="border border-white/18 bg-white/[.025]">
          <div className="flex items-center gap-3 border-b border-white/15 p-5"><span className="grid size-9 place-items-center rounded-full bg-[#ff7c68]/15 text-[#ff9a8a]"><CircleAlert className="size-4" /></span><div><p className="text-sm font-semibold">Lead form check failed on your website</p><p className="text-xs text-white/65">Email alert</p></div></div>
          <div className="grid gap-px bg-white/15 sm:grid-cols-3">
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Broken step</p><p className="mt-3 text-lg font-semibold">Confirmation missing</p></div>
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Last worked</p><p className="mt-3 text-lg font-semibold">Form accepted</p></div>
            <div className="bg-[#0b0e0c] p-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-white/65">Next action</p><p className="mt-3 text-lg font-semibold">Open check details</p></div>
          </div>
          <div className="p-5 text-sm leading-relaxed text-white/65">This shows the information every failure alert contains. Actual alerts use the result from your own authorized check.</div>
        </div>
      </div>
    </section>
  );
}

function ForEveryBusiness() {
  const businesses = [
    ["Home services", "Catch broken quote requests before a weekend of leads disappears."],
    ["Agencies", "Know when a client or new-business contact form stops working."],
    ["Consultants", "Protect the inquiry form that starts every new engagement."],
    ["B2B sales", "Verify demo requests reach the confirmation step every day."],
  ];
  return (
    <section className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end"><div><p className="eyebrow">Who it is for / 03</p><h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-[.9] tracking-[-.062em] md:text-7xl">For businesses that depend on website leads.</h2></div><p className="max-w-md text-sm leading-relaxed text-black/65">Start with the one form closest to revenue. If it fails silently, Signal Garden makes the failure impossible to miss.</p></div>
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
        <div><p className="eyebrow">Real check / 04</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em]">See the check that actually ran.</h2></div>
        <div className="border border-black/20 bg-[#f3efe6] p-6 md:p-8">
          <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-[#4f7134]" /><p className="font-semibold">This report comes from a real owner-authorized check.</p></div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-black/65">It shows whether the page opened, the form accepted the test lead, and the expected confirmation arrived. Form contents and email addresses stay private.</p>
          {featuredReportSlug ? <Button asChild variant="outline" className="mt-6 rounded-full bg-transparent"><Link to={`/proof/${featuredReportSlug}`}>Inspect the latest real check <ExternalLink /></Link></Button> : <p className="mt-6 inline-flex items-center gap-2 border border-black/20 px-4 py-2 text-xs text-black/65"><span className="size-2 rounded-full bg-[#4f7134]" /> The first owner-authorized check will appear here.</p>}
        </div>
      </div>
    </section>
  );
}

function PrivateBeta() {
  return (
    <section className="px-5 py-20 md:px-8 lg:px-12 lg:py-28">
      <div className="grid border border-black/20 lg:grid-cols-[1fr_1fr]">
        <div className="border-b border-black/20 p-6 md:p-9 lg:border-b-0 lg:border-r lg:p-12"><p className="eyebrow">Free private beta / 05</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">Prove it on one important form.</h2><p className="mt-6 max-w-lg text-base leading-relaxed text-black/65">Free while we validate Signal Garden with early businesses. No card required.</p></div>
        <div className="bg-[#0b0e0c] p-6 text-[#f3efe6] md:p-10 lg:p-12">
          <p className="text-sm font-semibold text-[#c8ff53]">Included</p>
          <ul className="mt-7 space-y-5">
            {["1 website", "1 monitored lead form", "1 real check every day", "Failure emails to the owner"].map((item) => <li key={item} className="flex items-center gap-3 border-b border-white/15 pb-5 text-lg"><Check className="size-5 text-[#c8ff53]" />{item}</li>)}
          </ul>
          <Button asChild className="mt-8 h-12 w-full rounded-full bg-[#c8ff53] text-[#111612] hover:bg-[#d6ff7b]"><a href="#check">Start free <ArrowRight /></a></Button>
        </div>
      </div>
    </section>
  );
}

function FinalCall() {
  return (
    <section id="check" className="px-5 pb-20 md:px-8 lg:px-12 lg:pb-28">
      <div className="grid border border-black/20 lg:grid-cols-[.9fr_1.1fr]">
        <div className="border-b border-black/20 p-6 md:p-9 lg:border-b-0 lg:border-r lg:p-12"><p className="eyebrow">Start monitoring</p><h2 className="mt-5 text-5xl font-semibold leading-[.9] tracking-[-.06em] md:text-7xl">Check whether your lead form actually works.</h2><p className="mt-6 max-w-lg text-base leading-relaxed text-black/65">Enter your website and the email that should receive the private setup link. No test runs until you review and authorize it.</p></div>
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
    return <div className="grid min-h-[420px] place-items-center bg-[#0b0e0c] p-8 text-[#f3efe6]"><div className="max-w-md text-center"><span className="mx-auto grid size-14 place-items-center rounded-full bg-[#c8ff53] text-[#111612]"><MailCheck /></span><h3 className="mt-6 text-4xl font-semibold tracking-[-.05em]">Check your inbox.</h3><p className="mt-4 text-sm leading-relaxed text-white/65">Your private setup link is on the way. No lead-form check runs until you sign in, review the exact form, and authorize it.</p></div></div>;
  }
  return (
    <form className="flex min-h-[420px] flex-col justify-center bg-[#0b0e0c] p-6 text-[#f3efe6] md:p-10 lg:p-12" onSubmit={(event) => { event.preventDefault(); setStatus("sending"); setError(""); void requestAudit({ websiteUrl, email }).then(() => setStatus("sent")).catch((reason: unknown) => { setError(reason instanceof Error ? reason.message : "The setup link could not be sent"); setStatus("idle"); }); }}>
      <div><Label htmlFor="audit-website" className="text-white/65">Website</Label><Input id="audit-website" type="url" inputMode="url" placeholder="https://yourbusiness.com" required value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} className="mt-2 h-14 border-white/22 bg-white/[.04] px-4 text-base text-white placeholder:text-white/65" /></div>
      <div className="mt-5"><Label htmlFor="audit-email" className="text-white/65">Email for the private setup link</Label><Input id="audit-email" type="email" autoComplete="email" placeholder="you@company.com" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-14 border-white/22 bg-white/[.04] px-4 text-base text-white placeholder:text-white/65" /></div>
      {error && <p role="alert" className="mt-4 text-sm text-[#ff9a8a]">{error}</p>}
      <Button type="submit" disabled={status === "sending"} className="mt-7 h-13 rounded-full bg-[#c8ff53] text-[#111612] hover:bg-[#d6ff7b]">{status === "sending" ? "Sending setup link…" : "Send me the setup link"}{status !== "sending" && <ArrowRight />}</Button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-white/65">Free private beta. Public websites only. Nothing is submitted without your approval.</p>
    </form>
  );
}
