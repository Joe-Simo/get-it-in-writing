import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { ArrowLeft, LoaderCircle, LockKeyhole } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { PromiseSeal } from "@/components/PromiseSeal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/lib/utils";

type AuthFlow = "signIn" | "signUp" | "reset" | "reset-verification";

const fallbackErrors: Record<AuthFlow, string> = {
  signIn:
    "That email and password combination was not accepted. Check both and try again.",
  signUp:
    "The account could not be created. If this email already has a wallet, choose “Already have an account? Sign in” below; otherwise use a valid email and a password of at least 8 characters.",
  reset:
    "A reset code could not be sent. Check the email address and try again.",
  "reset-verification":
    "That code was not accepted. Check the 8-digit code from your email, use a new password of at least 8 characters, or request a fresh code.",
};

export default function SignInPage() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<AuthFlow>("signIn");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    form.set("flow", flow);
    const emailEntry = form.get("email");
    const email = typeof emailEntry === "string" ? emailEntry.trim() : "";
    if (flow === "reset-verification") form.set("email", resetEmail);
    void signIn("password", form)
      .then(() => {
        if (flow === "reset") {
          setResetEmail(email);
          setFlow("reset-verification");
          setNotice(
            `We emailed an 8-digit code to ${email}. Enter it below with your new password.`,
          );
        }
      })
      .catch((reason: unknown) => setError(errorText(reason, fallbackErrors[flow])))
      .finally(() => setPending(false));
  }

  function switchFlow(next: AuthFlow) {
    setFlow(next);
    setError("");
    setNotice("");
  }

  const heading =
    flow === "signIn"
      ? { label: "Welcome back", title: "Open your decisions." }
      : flow === "signUp"
        ? { label: "Create your private wallet", title: "Start protecting decisions." }
        : flow === "reset"
          ? { label: "Reset your password", title: "Get back into your wallet." }
          : { label: "Check your email", title: "Enter your reset code." };

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
          <p className="ink-label">{heading.label}</p>
          <h1>{heading.title}</h1>
          <div className="mt-10 space-y-5">
            {flow === "reset-verification" ? (
              <>
                <div>
                  <Label htmlFor="reset-code">8-digit code</Label>
                  <Input id="reset-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required className="mt-2 h-12 tracking-[.35em]" />
                </div>
                <div>
                  <Label htmlFor="reset-password">New password</Label>
                  <Input id="reset-password" name="newPassword" type="password" minLength={8} required autoComplete="new-password" className="mt-2 h-12" />
                </div>
              </>
            ) : (
              <>
                <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" className="mt-2 h-12" /></div>
                {flow !== "reset" && (
                  <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" minLength={8} required autoComplete={flow === "signIn" ? "current-password" : "new-password"} className="mt-2 h-12" /></div>
                )}
              </>
            )}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-[#a5281b]">{error}</p>}
          {notice && <p role="status" className="mt-4 text-sm text-ink/70">{notice}</p>}
          <Button type="submit" disabled={pending} className="mt-8 h-12 w-full rounded-none bg-cobalt text-white hover:bg-[#153ae8]">
            {pending && <LoaderCircle className="animate-spin" />}
            {flow === "signIn"
              ? "Sign in"
              : flow === "signUp"
                ? "Create account"
                : flow === "reset"
                  ? "Email me a reset code"
                  : "Set new password"}
          </Button>
          {flow === "signIn" && (
            <button type="button" className="mt-5 w-full text-sm text-ink/60 hover:text-ink" onClick={() => switchFlow("reset")}>Forgot your password?</button>
          )}
          {flow === "reset-verification" && (
            <button type="button" className="mt-5 w-full text-sm text-ink/60 hover:text-ink" onClick={() => switchFlow("reset")}>Didn’t get a code? Send a new one</button>
          )}
          <button
            type="button"
            className="mt-3 w-full text-sm text-ink/60 hover:text-ink"
            onClick={() => switchFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
