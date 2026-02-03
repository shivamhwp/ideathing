/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as ideas_actions from "../ideas/actions.js";
import type * as ideas_mutations from "../ideas/mutations.js";
import type * as ideas_queries from "../ideas/queries.js";
import type * as notion_actions from "../notion/actions.js";
import type * as notion_mutations from "../notion/mutations.js";
import type * as notion_queries from "../notion/queries.js";
import type * as notion_utils_client from "../notion/utils/client.js";
import type * as notion_utils_oauth from "../notion/utils/oauth.js";
import type * as types_identity from "../types/identity.js";
import type * as utils_auth from "../utils/auth.js";
import type * as utils_files from "../utils/files.js";
import type * as utils_types from "../utils/types.js";

import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  "ideas/actions": typeof ideas_actions;
  "ideas/mutations": typeof ideas_mutations;
  "ideas/queries": typeof ideas_queries;
  "notion/actions": typeof notion_actions;
  "notion/mutations": typeof notion_mutations;
  "notion/queries": typeof notion_queries;
  "notion/utils/client": typeof notion_utils_client;
  "notion/utils/oauth": typeof notion_utils_oauth;
  "types/identity": typeof types_identity;
  "utils/auth": typeof utils_auth;
  "utils/files": typeof utils_files;
  "utils/types": typeof utils_types;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;

export declare const components: {};
