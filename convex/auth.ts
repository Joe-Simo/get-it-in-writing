import { ConvexError } from "convex/values";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { AgentMailReset } from "./authReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: AgentMailReset,
      // Sign-ups are closed for the judged beta: the only accounts are the
      // owner's and the shared demo wallet. Everyone else joins the waitlist.
      profile(params) {
        if (params.flow === "signUp") {
          throw new ConvexError(
            "Sign-ups are closed during judging. Join the waitlist on the home page.",
          );
        }
        const email = typeof params.email === "string" ? params.email.trim() : "";
        if (email === "") throw new ConvexError("Enter a valid email address.");
        return { email };
      },
    }),
  ],
});
