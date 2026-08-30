import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type ReadCtx = QueryCtx | MutationCtx;

export async function requireUserId(ctx: ReadCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("401: sign in required");
  return userId;
}

export async function requireTeamMember(
  ctx: ReadCtx,
  teamId: Id<"teams">,
): Promise<{ userId: Id<"users">; role: "owner" | "member" }> {
  const userId = await requireUserId(ctx);
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_userId_and_teamId", (q) =>
      q.eq("userId", userId).eq("teamId", teamId),
    )
    .unique();
  if (membership === null) throw new Error("403: team membership required");
  return { userId, role: membership.role };
}
