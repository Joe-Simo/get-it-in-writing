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
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as intake from "../intake.js";
import type * as intakeActions from "../intakeActions.js";
import type * as journeyActions from "../journeyActions.js";
import type * as journeys from "../journeys.js";
import type * as lib_journeySafety from "../lib/journeySafety.js";
import type * as model_auth from "../model/auth.js";
import type * as teamActions from "../teamActions.js";
import type * as teams from "../teams.js";
import type * as webhookVerification from "../webhookVerification.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  alertActions: typeof alertActions;
  alerts: typeof alerts;
  auth: typeof auth;
  crons: typeof crons;
  http: typeof http;
  intake: typeof intake;
  intakeActions: typeof intakeActions;
  journeyActions: typeof journeyActions;
  journeys: typeof journeys;
  "lib/journeySafety": typeof lib_journeySafety;
  "model/auth": typeof model_auth;
  teamActions: typeof teamActions;
  teams: typeof teams;
  webhookVerification: typeof webhookVerification;
  webhooks: typeof webhooks;
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
};
