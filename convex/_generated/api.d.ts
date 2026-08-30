/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as alertActions from "../alertActions.js";
import type * as alerts from "../alerts.js";
import type * as auth from "../auth.js";
import type * as construction from "../construction.js";
import type * as crons from "../crons.js";
import type * as emailActions from "../emailActions.js";
import type * as emails from "../emails.js";
import type * as gardens from "../gardens.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as intakeActions from "../intakeActions.js";
import type * as journeyActions from "../journeyActions.js";
import type * as journeys from "../journeys.js";
import type * as lib_constructionRules from "../lib/constructionRules.js";
import type * as lib_firecrawlRetry from "../lib/firecrawlRetry.js";
import type * as lib_journeySafety from "../lib/journeySafety.js";
import type * as lib_releaseGate from "../lib/releaseGate.js";
import type * as lib_webhookAuth from "../lib/webhookAuth.js";
import type * as missions from "../missions.js";
import type * as model_auth from "../model/auth.js";
import type * as outreach from "../outreach.js";
import type * as outreachActions from "../outreachActions.js";
import type * as pipeline from "../pipeline.js";
import type * as pipelineActions from "../pipelineActions.js";
import type * as readiness from "../readiness.js";
import type * as release from "../release.js";
import type * as requirements from "../requirements.js";
import type * as review from "../review.js";
import type * as teamActions from "../teamActions.js";
import type * as teams from "../teams.js";
import type * as watchActions from "../watchActions.js";
import type * as watches from "../watches.js";
import type * as webhookVerification from "../webhookVerification.js";
import type * as webhooks from "../webhooks.js";
import type * as workflowManager from "../workflowManager.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alertActions: typeof alertActions;
  alerts: typeof alerts;
  auth: typeof auth;
  construction: typeof construction;
  crons: typeof crons;
  emailActions: typeof emailActions;
  emails: typeof emails;
  gardens: typeof gardens;
  http: typeof http;
  intake: typeof intake;
  intakeActions: typeof intakeActions;
  journeyActions: typeof journeyActions;
  journeys: typeof journeys;
  "lib/constructionRules": typeof lib_constructionRules;
  "lib/firecrawlRetry": typeof lib_firecrawlRetry;
  "lib/journeySafety": typeof lib_journeySafety;
  "lib/releaseGate": typeof lib_releaseGate;
  "lib/webhookAuth": typeof lib_webhookAuth;
  missions: typeof missions;
  "model/auth": typeof model_auth;
  outreach: typeof outreach;
  outreachActions: typeof outreachActions;
  pipeline: typeof pipeline;
  pipelineActions: typeof pipelineActions;
  readiness: typeof readiness;
  release: typeof release;
  requirements: typeof requirements;
  review: typeof review;
  teamActions: typeof teamActions;
  teams: typeof teams;
  watchActions: typeof watchActions;
  watches: typeof watches;
  webhookVerification: typeof webhookVerification;
  webhooks: typeof webhooks;
  workflowManager: typeof workflowManager;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
};
