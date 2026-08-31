import { Email } from "@convex-dev/auth/providers/Email";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { GenericDataModel } from "convex/server";
import { internal } from "./_generated/api";

// Password-reset codes travel through the app's own AgentMail inbox. The
// 8-digit code is bound to the account email by the provider's default
// authorize check and expires after 15 minutes.
export const AgentMailReset = Email({
  id: "agentmail-reset",
  maxAge: 15 * 60,
  async generateVerificationToken() {
    const digits = new Uint32Array(8);
    crypto.getRandomValues(digits);
    return Array.from(digits, (value) => String(value % 10)).join("");
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    // Convex Auth passes the action ctx as a second argument at runtime; its
    // published type only declares the Auth.js single-parameter signature.
    ctx?: GenericActionCtxWithAuthConfig<GenericDataModel>,
  ) {
    if (!ctx) throw new Error("Password reset requires the Convex action context");
    await ctx.runMutation(internal.confirmations.sendPasswordResetCode, {
      email,
      code: token,
    });
  },
});
