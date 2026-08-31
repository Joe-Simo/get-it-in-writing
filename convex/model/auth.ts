import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

// The shared wallet judges can open with published credentials. Anyone on the
// internet holds its password, so it can browse everything and change nothing.
export const DEMO_WALLET_EMAIL = "judge@getitinwriting.demo";

export async function requireUserId(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new ConvexError("Sign in to continue.");
  return userId;
}

// For mutations: the demo wallet is a showcase, not a sandbox — its published
// credentials must never let a visitor send email, delete cases, or spend the
// shared research budget.
export async function requireInteractiveUser(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get("users", userId);
  if (user?.email === DEMO_WALLET_EMAIL) {
    throw new ConvexError(
      "This shared demo wallet is read-only. Create your own free account to run a live decision.",
    );
  }
  return userId;
}
