import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { normalizeEmail } from "./lib/validation";
import { enforceWaitlistLimit } from "./limits";

// Sign-ups are closed for the judged beta; this is the public front door.
// Joining is idempotent per address so a repeat visit never errors or reveals
// whether an address was already on the list.
export const join = mutation({
  args: { email: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await enforceWaitlistLimit(ctx);
    const email = normalizeEmail(args.email);
    const existing = await ctx.db
      .query("waitlist")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing !== null) return null;
    await ctx.db.insert("waitlist", { email, createdAt: Date.now() });
    return null;
  },
});
