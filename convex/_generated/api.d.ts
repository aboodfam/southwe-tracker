/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as account from "../account.js";
import type * as athkar from "../athkar.js";
import type * as auth from "../auth.js";
import type * as daily from "../daily.js";
import type * as date from "../date.js";
import type * as daySupport from "../daySupport.js";
import type * as deviceAuth from "../deviceAuth.js";
import type * as habits from "../habits.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as planFormat from "../planFormat.js";
import type * as progress from "../progress.js";
import type * as progressMath from "../progressMath.js";
import type * as recovery from "../recovery.js";
import type * as router from "../router.js";
import type * as routines from "../routines.js";
import type * as security from "../security.js";
import type * as supportModel from "../supportModel.js";
import type * as userData from "../userData.js";
import type * as workouts from "../workouts.js";
import type * as workspace from "../workspace.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  account: typeof account;
  athkar: typeof athkar;
  auth: typeof auth;
  daily: typeof daily;
  date: typeof date;
  daySupport: typeof daySupport;
  deviceAuth: typeof deviceAuth;
  habits: typeof habits;
  http: typeof http;
  migrations: typeof migrations;
  planFormat: typeof planFormat;
  progress: typeof progress;
  progressMath: typeof progressMath;
  recovery: typeof recovery;
  router: typeof router;
  routines: typeof routines;
  security: typeof security;
  supportModel: typeof supportModel;
  userData: typeof userData;
  workouts: typeof workouts;
  workspace: typeof workspace;
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

export declare const components: {};
