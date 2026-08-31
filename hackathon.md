# Hackathon log

- **Project:** Get It in Writing
- **Event:** Convex All Gas Hackathon
- **What it does:** Checks every requirement behind an everyday decision against official sources, gets only consequential gaps confirmed in writing with the user's approval, and preserves scoped evidence and conditions in a private Proof Card.
- **Live app:** https://resilient-salamander-937.convex.site
- **Repo:** https://github.com/Joe-Simo/get-it-in-writing
- **Frontend:** Convex static hosting
- **Convex deployment:** https://resilient-salamander-937.convex.cloud
- **Components:** @agentmail/convex, @firecrawl/firecrawl-convex, @convex-dev/rate-limiter, @convex-dev/static-hosting
- **Convex features:** schema, tables, indexes, realtime queries, mutations, actions, HTTP actions, scheduled functions, crons
- **Auth:** Convex Auth
- **AI models:** gpt-5.6-luna
- **Started:** 2026-08-29T23:28:53Z
- **Last updated:** 2026-08-31T02:10:11Z

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

### 2026-08-30 - 405840d

Moved the production frontend to a Next.js 16 static export with Geist while
preserving the private Promise Wallet and Convex Static Hosting path. Replaced
inbox polling with one authenticated, inbox-scoped AgentMail webhook and a
least-privilege integration boundary (`app/`, `convex/readiness.ts`,
`convex/confirmations.ts`, `convex/crons.ts`).

Added delivery-failure and high-risk safety coverage. Verified strict lint and
type checking, 22 focused tests, the production build, and 14 applicable
desktop/mobile browser journeys covering keyboard access, reduced motion,
forced colors, zoom-equivalent layout, and the no-WebGPU fallback.

### 2026-08-30 - e49d1bf

Made unsupported decisions stop without displaying false research progress and
added owner-authorized, two-step deletion for an entire private case graph.
Deletion removes requirements, sources, assessments, evidence, drafts, replies,
Proof Cards, monitors, and timeline events (`convex/decisions.ts`,
`src/backend/DecisionPage.tsx`).

Added ownership and cascading-deletion coverage. Deployed the correction and
verified strict lint and type checking, 23 focused tests, the production build,
and 14 applicable desktop/mobile browser journeys.

### 2026-08-30 - 1c056e8

Hardened the real decision lifecycle around provider-owned evidence. When the
initial crawl does not expose a usable contact, Firecrawl now performs a
same-domain contact search; only relevant service mailboxes found verbatim on
official pages are accepted. Legal, privacy, career, and no-reply addresses are
rejected. The confirmation interface now locks a source-checked recipient to
its evidence and exposes manual entry only as an explicit alternative.

Created a genuine production pre-booking case for Abode Malua Bay. The live
Reliance Map preserved six official pages, found that interconnecting rooms are
subject to availability and cannot be guaranteed by the published language,
and prepared one narrowly scoped request to the provider's published
Reservations address. The exact draft is saved and remains unsent pending the
owner's explicit approval; no reply or Proof Card is claimed yet.

Added deterministic ownership, inbound-reply, source-change, duplicate-event,
and official-contact tests. Fixed a WebGPU readiness race and expanded rendered
coverage to 1440, 1024, 768, and 390 pixel widths. Verified strict lint and type
checking, 27 unit/integration tests, the production build, and 23 applicable
browser checks before deploying only `joe-simo/signal-garden-all-gas` to Convex
Static Hosting.

### 2026-08-30 - f720cc6

Sent the real Abode Malua Bay confirmation request after the owner approved its
exact source-checked recipient and wording. AgentMail accepted exactly one
outbound message, and the live private case moved to Sent while it waits for a
genuine provider reply; no reply or Proof Card is claimed yet.

Added a safe delivery-recovery state that distinguishes Not sent from Sending,
hides infrastructure details, and retries only the unchanged approved message
after a confirmed provider failure. Patched the current AgentMail Convex
component to use Convex's isolated environment-variable mapping, scoped the
production credential to this app's single inbox, and deployed only
`joe-simo/signal-garden-all-gas`. Verified strict lint and type checking, 27
unit/integration tests, the production build, and 23 applicable browser checks.

### 2026-08-31 - 6ce680b

Ran a full readiness audit of the backend, workspace, and live site, then
hardened the real decision lifecycle around provider behavior. Replies from
another mailbox on the recipient's own domain are now accepted, while
unrelated senders are set aside with a visible case-record trace instead of
disappearing. A failed reply interpretation gained an owner-only retry, late
delivery events can no longer pull a finished case back to waiting or stamp
false failures, hard-stalled pipeline stages unlock the existing retry, stale
crawl callbacks are ignored, and case deletion continues across transactions
(`convex/confirmations.ts`, `convex/decisions.ts`, `convex/research.ts`).

Because production redacts plain error messages, every user-facing error now
travels as ConvexError with real copy. Fixed the confirmation panel showing a
published contact while a saved manual address would receive the email, added
the missing auth loading state, made malformed case links render the designed
not-found state, gave source checks visible feedback, repainted the
reduced-motion seal after resizes, lifted sub-10px evidence type, and
tightened wallet filter semantics (`src/backend/`, `src/components/`,
`src/index.css`). Added the brand favicon set and a social share card.

Verified strict lint and type checking, 30 unit/integration tests including
new late-event and reply-retry regression coverage, the production build, and
23 desktop/mobile browser journeys, then deployed only
`joe-simo/signal-garden-all-gas` and confirmed the live site serves the new
assets with no console errors.

### 2026-08-31 - 6027c7c

Closed the last missing account journey: password reset. The sign-in page can
now email an 8-digit one-time code through the app's own AgentMail inbox; the
code is bound to the account email, expires after 15 minutes, and setting the
new password signs the owner straight back into their wallet
(`convex/authReset.ts`, `convex/auth.ts`, `src/backend/SignInPage.tsx`).
Clarified the account-creation error when an email already has a wallet.

Verified strict lint and type checking, 30 tests, and the production build,
deployed only `joe-simo/signal-garden-all-gas`, and confirmed one real reset
code delivered through AgentMail on the live deployment.

### 2026-08-31 - 23b7437

Prepared the app for public judging traffic. Mounted the official Convex rate
limiter component and metered the costly boundaries — research runs per
account and across the deployment, approved sends per account and across the
deployment, and password-reset codes per address — with calm, user-facing
copy that says exactly when to retry (`convex/limits.ts`,
`convex/convex.config.ts`). Added a one-click worked example to the landing
card and the new-decision form that runs the genuine crawl and analysis
against an official page the pipeline has already handled in production.

Verified strict lint and type checking, 31 tests including per-account
metering coverage, the production build, and 23 desktop/mobile browser
journeys with Axe (which caught and forced a contrast fix on the new example
control), then deployed only `joe-simo/get-it-in-writing`.

### 2026-08-31 - b2c593d

Turned the landing hero into an ink stage built on vgpu compute passes: a
pressure-projected flow field carries a monochrome wash that is emitted from
the rasterized headline word "probably." itself, drifts with buoyancy and a
slow breeze, smears under the pointer, and always settles — the tagline
performing the product's thesis. The wash composites as watercolor over the
page with granulation and a hard alpha cap so text contrast always holds;
reduced motion, forced colors, and missing WebGPU fall back to the static
seal (`src/visual/ink/`, `src/marketing/LandingPage.tsx`).

Opened a shared read-only demo wallet for judging. Its published credentials
can browse everything and change nothing — every mutating function refuses
the account with clear copy — and its cases are seeded through the genuine
scope, crawl, and analysis pipeline rather than authored rows
(`convex/demo.ts`, `convex/model/auth.ts`).

Verified strict lint and type checking, 32 tests, the production build, and
23 desktop/mobile browser journeys including the new ink-stage fallback
contract, then deployed only `joe-simo/get-it-in-writing`.
