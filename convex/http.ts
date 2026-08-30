import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import type { AgentMailEvent } from "@agentmail/convex";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

declare const process: { env: Record<string, string | undefined> };

async function secureEqual(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all(
    [left, right].map((value) =>
      crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return difference === 0;
}

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    const authorization = request.headers.get("authorization") ?? "";
    if (!secret) return new Response("Webhook unavailable", { status: 503 });
    if (!await secureEqual(authorization, `Bearer ${secret}`)) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const event = (await request.json()) as AgentMailEvent;
      await ctx.runMutation(internal.confirmations.ingestAgentMailEvent, { event });
      return new Response("Accepted", { status: 200 });
    } catch {
      return new Response("Invalid event", { status: 400 });
    }
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
