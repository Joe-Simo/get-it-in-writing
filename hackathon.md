# Hackathon log

- **Project:** Get It in Writing
- **Event:** Convex All Gas Hackathon
- **What it does:** Checks every requirement behind an everyday decision against official sources, gets only consequential gaps confirmed in writing with the user's approval, and preserves scoped evidence and conditions in a private Proof Card.
- **Live app:** https://resilient-salamander-937.convex.site
- **Repo:** https://github.com/Joe-Simo/signal-garden-all-gas
- **Frontend:** Convex static hosting
- **Convex deployment:** https://resilient-salamander-937.convex.cloud
- **Components:** @agentmail/convex, @firecrawl/firecrawl-convex, @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, realtime queries, mutations, actions, HTTP actions, scheduled functions, crons
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-luna
- **Started:** 2026-08-29T23:28:53Z
- **Last updated:** 2026-08-30T20:35:45Z

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

### 2026-08-30 - 814fd92

Rebuilt Signal Garden around one concrete promise: it tests an authorized lead
form every day and emails the owner when the page, submission, or confirmation
fails. Simplified the public site and private workspace around forms, checks,
alerts, evidence, and a free one-site private beta.

Added durable AgentMail owner-alert deliveries with deduplicated sends,
bounded retries, a five-minute retry cron, and a real owner-only test-alert
action. Customer-facing failures queue an alert; provider execution errors do
not create false incidents or failure emails (`convex/alerts.ts`,
`convex/alertActions.ts`, `convex/journeys.ts`, `convex/crons.ts`).

Deployed only the dedicated `signal-garden-all-gas` production project. The
owner test alert delivered through AgentMail on its first attempt and Convex
recorded it as sent. Verified strict lint and type checking, 42 focused tests,
all three WebGPU shaders, the production build, nine local desktop/mobile
browser journeys, and zero Axe violations or console errors on the live landing
and proof pages at desktop and mobile sizes.

Public journey proof:
https://resilient-salamander-937.convex.site/proof/setup-request-to-confirmation-cd8df1tc

### 2026-08-30 - d9518cc

Finished the one-site private beta as a focused lead-form monitor: one approved
form, one real submission per day, and an owner email only when a customer-facing
step actually fails. Emailed setup links are now expiring, recipient-bound, and
carry the verified website into onboarding.

Separated safety stops from failures, paused forms that need owner review, made
alert retries and result recording idempotent, and prevented one confirmation
message from satisfying multiple checks. Retired the earlier research and bid
product from the UI, routes, functions, crons, schema, components, dependencies,
and tests.

Deployed only `joe-simo/signal-garden-all-gas` to its dedicated development and
production deployments. Verified a real AgentMail setup delivery, the live app
and public check, strict lint, 21 focused tests, the production build, and nine
desktop/mobile Playwright journeys with Axe and keyboard coverage.

### 2026-08-30 - 2d59515

Rebuilt the product as Get It in Writing around one consumer outcome: paste an
official page, state what must be true, and receive a conservative Reliance Map
that separates established language from vague or missing commitments. An
unresolved material point becomes one editable confirmation request; nothing is
sent until the owner approves the exact recipient and message.

Added private, realtime decision records and Proof Cards, official-source-only
Firecrawl research, structured OpenAI analysis with verified excerpts, and an
AgentMail delivery/reply loop with sender matching, delivery reconciliation,
idempotent inbound handling, and at most one suggested follow-up
(`convex/decisions.ts`, `convex/research.ts`, `convex/researchOpenAI.ts`,
`convex/confirmations.ts`, `convex/confirmationOpenAI.ts`).

Replaced the public and signed-in experience with a responsive Promise Wallet
interface and a reduced-motion, forced-colors-safe WebGPU seal. Deployed the
new frontend to Convex Static Hosting. A real development run crawled the live
official page, persisted one source and one conservative assessment, created a
private confirmation draft, found no official contact, and sent nothing.
Verified strict lint and type checking, 12 focused tests, 14 browser journeys,
the production build, shader validation, desktop/mobile layout, accessibility,
and the no-WebGPU fallback.

### 2026-08-30 - 123f451

Completed the full multi-requirement lifecycle. OpenAI now scopes a decision
before research; Firecrawl stores official pages progressively; and the
Reliance Map keeps established, conditional, conflicting, scope-mismatched, and
not-established outcomes distinct. Proof Cards preserve per-requirement reply
outcomes, source excerpts, conditions, and later source changes instead of
flattening them into a summary (`convex/decisions.ts`, `convex/research.ts`,
`convex/researchOpenAI.ts`, `convex/confirmationOpenAI.ts`,
`convex/changes.ts`).

Finished the real communication boundary: exact-recipient and exact-message
approval remains mandatory, replies are sender- and thread-matched, duplicate
events are ignored, one approved follow-up is allowed, and a Convex cron checks
the single configured AgentMail inbox every minute when webhook administration
is unavailable (`convex/confirmations.ts`, `convex/crons.ts`, `convex/http.ts`).
Added explicit high-stakes exclusions and requirement-level security tests.

Deployed only `joe-simo/signal-garden-all-gas` to its dedicated production
deployment and refreshed Convex Static Hosting. Live readiness checks confirmed
Firecrawl, OpenAI, AgentMail, and AgentMail reply ingestion; the authenticated
webhook route rejects unsigned requests. Verified strict lint and type checking,
20 focused tests, the production build, 14 desktop/mobile browser journeys,
reduced motion, forced colors, mobile overflow, the final production asset, and
zero console errors on the live landing page.
