import { DAY, HOUR, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";

// The app runs on shared research, analysis, and email budgets, so the costly
// entry points are metered: research per account and across the deployment,
// approved sends per account and across the deployment, and reset codes per
// address so nobody's inbox can be flooded.
const limiter = new RateLimiter(components.rateLimiter, {
  researchPerUser: { kind: "token bucket", rate: 6, period: HOUR, capacity: 3 },
  researchGlobal: { kind: "fixed window", rate: 120, period: DAY },
  sendPerUser: { kind: "token bucket", rate: 5, period: DAY, capacity: 3 },
  sendGlobal: { kind: "fixed window", rate: 25, period: DAY },
  resetCodePerEmail: { kind: "token bucket", rate: 3, period: HOUR, capacity: 3 },
  resetCodeGlobal: { kind: "fixed window", rate: 30, period: DAY },
});

type LimitName =
  | "researchPerUser"
  | "researchGlobal"
  | "sendPerUser"
  | "sendGlobal"
  | "resetCodePerEmail"
  | "resetCodeGlobal";

function waitText(retryAfter: number | undefined) {
  const minutes = Math.max(1, Math.ceil((retryAfter ?? 60_000) / 60_000));
  if (minutes < 60) return `about ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.ceil(minutes / 60);
  return `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
}

async function enforce(
  ctx: MutationCtx,
  name: LimitName,
  key: string | undefined,
  message: (wait: string) => string,
) {
  const status = await limiter.limit(ctx, name, key ? { key } : {});
  if (!status.ok) throw new ConvexError(message(waitText(status.retryAfter)));
}

export async function enforceResearchLimit(ctx: MutationCtx, userId: string) {
  await enforce(ctx, "researchPerUser", userId, (wait) =>
    `This shared beta allows a few research runs per hour for each account. Try again in ${wait}.`,
  );
  await enforce(ctx, "researchGlobal", undefined, (wait) =>
    `The shared research budget for today is used up. Try again in ${wait}.`,
  );
}

export async function enforceSendLimit(ctx: MutationCtx, userId: string) {
  await enforce(ctx, "sendPerUser", userId, (wait) =>
    `This shared beta allows a few approved sends per day for each account. Try again in ${wait}.`,
  );
  await enforce(ctx, "sendGlobal", undefined, (wait) =>
    `The shared sending budget for today is used up. Your draft is saved; try again in ${wait}.`,
  );
}

export async function enforceResetCodeLimit(ctx: MutationCtx, email: string) {
  await enforce(ctx, "resetCodePerEmail", email.toLowerCase(), (wait) =>
    `A few reset codes were already sent to this address. Check your inbox, or try again in ${wait}.`,
  );
  await enforce(ctx, "resetCodeGlobal", undefined, (wait) =>
    `Password resets are briefly paused on this shared beta. Try again in ${wait}.`,
  );
}
