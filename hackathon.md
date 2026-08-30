# Hackathon log

- **Project:** Signal Garden
- **Event:** Convex All Gas Hackathon
- **What it does:** Runs bounded, collaborative research missions and turns source-linked claims into inspectable briefs.
- **Live app:** https://resilient-salamander-937.convex.site
- **Public garden:** https://resilient-salamander-937.convex.site/garden/how-should-small-teams-build-inspect-ef1e588f
- **Repo:** https://github.com/Joe-Simo/signal-garden-all-gas
- **Frontend:** Convex static hosting
- **Convex deployment:** https://resilient-salamander-937.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow
- **Convex features:** schema, tables, indexes, realtime queries, mutations, actions, HTTP actions, scheduled functions
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-luna, gpt-5.6-terra
- **Started:** 2026-08-29T15:19:35Z
- **Last updated:** 2026-08-30T01:46:01Z

## Log

### 2026-08-29
Built Signal Garden's responsive research observatory, live evidence ledger,
team auth and invitations, bounded mission controls, and read-only public
gardens. Added durable workflows for Firecrawl ingestion and OpenAI extraction
and synthesis, plus verified AgentMail delivery and reply webhooks. Added
private claim notes, manual reply review, workflow-safe cancellation, and public
garden publish, copy, and revoke controls. Added multi-team switching, isolated
provider-readiness indicators, launch guards for missing OpenAI or Firecrawl
configuration, and safe failed-mission retries. Indexed pending invitation
lookups. Hardened multi-source missions so stale jobs and late failures cannot
overwrite the current attempt, while a transactional synthesis claim guarantees
one brief owner. Added focused Convex transaction tests for duplicate, stale,
and partial-failure callbacks. Made multi-seed page allocation sum exactly to
the declared crawl budget, enforced one page per admitted seed, and tested the
team membership spending boundary. Registered Convex Workflow and Static
Hosting; validated the anonymous local backend, authenticated desktop and
mobile mission journeys, vgpu shaders, accessibility, and production builds.
Provisioned a dedicated Convex cloud development deployment, synced the schema,
indexes, functions, HTTP routes, and registered components, and connected the
frontend build to that isolated backend. Authenticated the official Firecrawl
CLI, completed a real scrape, and scoped its runtime key to the dedicated
development deployment. Hardened provider readiness so Firecrawl and AgentMail
remain unavailable until their signed-webhook configuration is complete, added
focused tests for those gates, and re-synced the verified functions only to the
isolated development deployment. Provisioned fresh Convex Auth signing
configuration for this deployment and verified a real cloud sign-up and private
team creation from the local app. Created a dedicated, project-tagged AgentMail
inbox through the connected account and scoped its identifier to the isolated
development deployment. Replaced the Firecrawl dashboard dependency with a
project-generated custom webhook authorization header, retained HMAC support,
and verified the live route accepts the valid token and rejects an invalid one.
Scoped a dedicated AgentMail runtime key to only the Signal Garden inbox with
send-and-read access, registered a `message.received` webhook to the isolated
Convex development deployment, and verified the live route rejects unsigned
requests while accepting a correctly signed synthetic delivery that matches no
real email thread. Created the project's dedicated production deployment,
generated fresh production authentication material, installed the registered
Convex components, and published the frontend through Convex Static Hosting.
Verified the public site at desktop and mobile sizes, confirmed the production
workspace route loads, and found no application-originated console errors.
Scoped all required provider configuration to the production deployment and
verified its AgentMail route rejects unsigned requests and accepts a correctly
signed synthetic delivery that cannot match or modify a real email thread.
Moved the AgentMail `message.received` webhook from the development route to
the dedicated production route and repeated the signed and unsigned delivery
checks. Hardened Firecrawl launch behavior to honor provider retry windows,
submit bounded seeds sequentially, and terminate failed workflows truthfully
instead of leaving missions in progress. Added focused retry and terminal-state
tests, dry-ran the deployment against the dedicated Signal Garden production
project, and deployed only there. Ran a real production mission across the
Convex, OpenAI, and Firecrawl documentation: all three seeds reached a terminal
state, two sources yielded 21 inspectable claims, and the workflow produced a
cited brief. Published and independently verified its read-only public garden,
including the server-side exclusion of identities, email metadata, private
notes, and webhook records.
