import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, LoaderCircle, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { PromiseSeal } from "@/components/PromiseSeal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    form.set("flow", flow);
    void signIn("password", form)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Authentication failed"))
      .finally(() => setPending(false));
  }

  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Brand />
        <PromiseSeal className="auth-seal" intensity={0.72} />
        <div className="relative z-10">
          <p className="ink-label text-white/65">Your private promise record</p>
          <h1>Keep the answer you were willing to rely on.</h1>
          <p>Official sources, approved requests, real replies, and scoped Proof Cards stay together in one private wallet.</p>
        </div>
        <p className="relative z-10 flex items-center gap-2 text-sm text-white/65"><LockKeyhole className="size-4" /> Nothing is public by default.</p>
      </section>
      <section className="auth-form-pane">
        <form onSubmit={submit} className="w-full max-w-md">
          <Link to="/" className="mb-14 inline-flex items-center gap-2 text-sm text-ink/60 hover:text-ink"><ArrowLeft className="size-4" /> Back</Link>
          <p className="ink-label">{flow === "signIn" ? "Welcome back" : "Create your private wallet"}</p>
          <h1>{flow === "signIn" ? "Open your decisions." : "Start protecting decisions."}</h1>
          <div className="mt-10 space-y-5">
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" className="mt-2 h-12" /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={8} required autoComplete={flow === "signIn" ? "current-password" : "new-password"} className="mt-2 h-12" /></div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#a5281b]">{error}</p>}
          <Button type="submit" disabled={pending} className="mt-8 h-12 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]">{pending && <LoaderCircle className="animate-spin" />}{flow === "signIn" ? "Sign in" : "Create account"}</Button>
          <button type="button" className="mt-5 w-full text-sm text-ink/60 hover:text-ink" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>{flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
