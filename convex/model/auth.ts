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

// For owner-only mutations: the demo wallet's published credentials may
// explore and run bounded research, but must never send email, edit drafts,
// or delete cases.
export async function requireInteractiveUser(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get("users", userId);
  if (user?.email === DEMO_WALLET_EMAIL) {
    throw new ConvexError(
      "The shared demo wallet can explore cases and run research, but sending, editing, and deleting stay with the wallet's owner.",
    );
  }
  return userId;
}
