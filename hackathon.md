# Hackathon log

- **Project:** Signal Garden
- **Event:** Convex All Gas Hackathon
- **What it does:** Turns a consequential question and trusted URLs into a bounded, source-linked brief that a team can challenge and review by email.
- **Live app:** https://resilient-salamander-937.convex.site
- **Repo:** https://github.com/Joe-Simo/signal-garden-all-gas
- **Frontend:** Convex static hosting
- **Convex deployment:** https://resilient-salamander-937.convex.cloud
- **Components:** @convex-dev/static-hosting, @convex-dev/workflow
- **Convex features:** schema, tables, indexes, realtime queries, mutations, actions, HTTP actions, scheduled functions
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-luna, gpt-5.6-terra
- **Started:** 2026-08-29T23:28:53Z
- **Last updated:** 2026-08-30T03:43:00Z

## Log

### 2026-08-29 - d31bbd0

Built the first complete Signal Garden workflow: private teams, bounded research
missions, a realtime evidence graph, source-linked claims, decision briefs,
AgentMail review, and revocable public gardens. Added Convex Auth, Workflow,
Static Hosting, indexed data access, HTTP webhooks, and focused tests.

### 2026-08-30 - c3a7e1a

Provisioned the isolated `signal-garden-all-gas` development and production
deployments and connected the real OpenAI, Firecrawl, and AgentMail pipeline.
Published the app on Convex Static Hosting and verified one production research
mission and its privacy-safe public garden.

### 2026-08-30 - 940ac37

Removed video production from the current phase so the product could be reviewed
and improved before any final recording or contest submission. No submission was
made.

### 2026-08-30 - dba63a0

Replaced the earlier precomputed judge path with a real federal renovation bid decision
created under the existing production team. Firecrawl processed three official
sources, OpenAI structured 28 linked claims and synthesized the brief, Convex
published the live decision, and AgentMail exercised the delivery integration.
The initial invalid placeholder delivery was removed during the next production
correction instead of being represented as a real review.

The public page now derives every graph node, metric, process event, brief
section, and citation from production data while excluding identities, email
addresses, message contents, private notes, and webhook records server-side.
Refactored the private workspace into route-focused modules, added public-data
privacy tests, and verified lint, 15 tests, all vgpu shaders, the production
build, and 10 desktop/mobile browser journeys with Axe, keyboard, and reduced-
motion coverage.

Public decision:
https://resilient-salamander-937.convex.site/garden/what-must-a-small-construction-firm--52a65131

### 2026-08-30 - 81e04ea

Replaced the invalid placeholder delivery with an owner-approved production
review route. AgentMail delivered the live brief to the real reviewer, the
signed reply returned through the verified webhook, and the team completed the
manual review step. Production proof now reports one delivery and one verified
reply. Added owner-only review-route settings and recipient authorization tests
(`convex/teams.ts`, `convex/emails.ts`, `convex/emails.test.ts`).
