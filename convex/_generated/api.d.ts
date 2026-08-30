/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as emailActions from "../emailActions.js";
import type * as emails from "../emails.js";
import type * as gardens from "../gardens.js";
import type * as http from "../http.js";
import type * as lib_firecrawlRetry from "../lib/firecrawlRetry.js";
import type * as lib_webhookAuth from "../lib/webhookAuth.js";
import type * as missions from "../missions.js";
import type * as model_auth from "../model/auth.js";
import type * as pipeline from "../pipeline.js";
import type * as pipelineActions from "../pipelineActions.js";
import type * as readiness from "../readiness.js";
import type * as review from "../review.js";
import type * as teamActions from "../teamActions.js";
import type * as teams from "../teams.js";
import type * as webhookVerification from "../webhookVerification.js";
import type * as webhooks from "../webhooks.js";
import type * as workflowManager from "../workflowManager.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  emailActions: typeof emailActions;
  emails: typeof emails;
  gardens: typeof gardens;
  http: typeof http;
  "lib/firecrawlRetry": typeof lib_firecrawlRetry;
  "lib/webhookAuth": typeof lib_webhookAuth;
  missions: typeof missions;
  "model/auth": typeof model_auth;
  pipeline: typeof pipeline;
  pipelineActions: typeof pipelineActions;
  readiness: typeof readiness;
  review: typeof review;
  teamActions: typeof teamActions;
  teams: typeof teams;
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
