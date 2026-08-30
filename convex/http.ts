import { httpRouter } from "convex/server";
import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

http.route({
  path: "/webhooks/agentmail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payload = await request.text();
    const message = await ctx.runAction(internal.webhookVerification.verifyAgentMail, {
      payload,
      svixId: request.headers.get("svix-id") ?? "",
      svixTimestamp: request.headers.get("svix-timestamp") ?? "",
      svixSignature: request.headers.get("svix-signature") ?? "",
    });
    if (message === null) return new Response(null, { status: 401 });
    await ctx.runMutation(internal.webhooks.acceptAgentMail, message);
    return new Response(null, { status: 202 });
  }),
});

registerStaticRoutes(http, components.staticHosting);

export default http;
