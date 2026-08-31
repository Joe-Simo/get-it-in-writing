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
import type * as authReset from "../authReset.js";
import type * as changes from "../changes.js";
import type * as confirmationOpenAI from "../confirmationOpenAI.js";
import type * as confirmations from "../confirmations.js";
import type * as crons from "../crons.js";
import type * as decisions from "../decisions.js";
import type * as http from "../http.js";
import type * as lib_decisionState from "../lib/decisionState.js";
import type * as lib_officialContact from "../lib/officialContact.js";
import type * as lib_validation from "../lib/validation.js";
import type * as model_auth from "../model/auth.js";
import type * as readiness from "../readiness.js";
import type * as research from "../research.js";
import type * as researchOpenAI from "../researchOpenAI.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  authReset: typeof authReset;
  changes: typeof changes;
  confirmationOpenAI: typeof confirmationOpenAI;
  confirmations: typeof confirmations;
  crons: typeof crons;
  decisions: typeof decisions;
  http: typeof http;
  "lib/decisionState": typeof lib_decisionState;
  "lib/officialContact": typeof lib_officialContact;
  "lib/validation": typeof lib_validation;
  "model/auth": typeof model_auth;
  readiness: typeof readiness;
  research: typeof research;
  researchOpenAI: typeof researchOpenAI;
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
  agentmail: import("@agentmail/convex/_generated/component.js").ComponentApi<"agentmail">;
  firecrawl: import("@firecrawl/firecrawl-convex/_generated/component.js").ComponentApi<"firecrawl">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
