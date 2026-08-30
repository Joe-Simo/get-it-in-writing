import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "react-router-dom";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="grid min-h-screen bg-[#0a0d0b] text-[#f2eee5] lg:grid-cols-[1fr_520px]">
      <section className="hidden border-r border-white/20 p-12 lg:flex lg:flex-col lg:justify-between">
        <Link to="/" className="font-semibold">
          ◉ Signal Garden
        </Link>
        <div>
          <p className="eyebrow text-[#c7ff4a]">Team access</p>
          <h1 className="mt-5 max-w-3xl text-7xl font-semibold leading-[.86] tracking-[-.065em]">
            Open your decision workspace.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-white/55">
            Private decisions, live collaborators, and review-ready briefs stay
            scoped to your team.
          </p>
        </div>
        <p className="text-xs text-white/60">
          Password authentication is handled inside the isolated Convex backend.
        </p>
      </section>
      <section className="flex items-center p-6 sm:p-12">
        <form
          className="w-full"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            const form = new FormData(event.currentTarget);
            form.set("flow", flow);
            void signIn("password", form)
              .catch((reason: unknown) =>
                setError(
                  reason instanceof Error
                    ? reason.message
                    : "Authentication failed",
                ),
              )
              .finally(() => setPending(false));
          }}
        >
          <Link
            to="/"
            className="mb-16 inline-flex items-center gap-2 text-sm text-white/55 hover:text-white"
          >
            <ArrowLeft className="size-4" /> Back to Signal Garden
          </Link>
          <p className="eyebrow text-[#c7ff4a]">
            {flow === "signIn" ? "Welcome back" : "Create your account"}
          </p>
          <h2 className="mt-4 font-editorial text-5xl tracking-[-.04em]">
            {flow === "signIn"
              ? "Continue your work."
              : "Create your workspace."}
          </h2>
          <div className="mt-10 space-y-5">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 h-12 border-white/25 bg-white/5 text-white"
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={
                  flow === "signIn" ? "current-password" : "new-password"
                }
                className="mt-2 h-12 border-white/25 bg-white/5 text-white"
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 text-sm text-[#ff8a78]">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending}
            className="mt-8 h-12 w-full rounded-full bg-[#c7ff4a] text-[#111612] hover:bg-[#d8ff82]"
          >
            {pending && <LoaderCircle className="animate-spin" />}
            {flow === "signIn" ? "Sign in" : "Create account"}
          </Button>
          <button
            type="button"
            className="mt-5 w-full text-sm text-white/55 hover:text-white"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn"
              ? "New here? Create an account"
              : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

