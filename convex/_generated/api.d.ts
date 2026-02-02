/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as files from "../files.js";
import type * as http from "../http.js";
import type * as ideas from "../ideas.js";
import type * as notion from "../notion.js";
import type * as notion_api from "../notion/api.js";
import type * as notion_client from "../notion/client.js";
import type * as notion_index from "../notion/index.js";
import type * as notion_mutations from "../notion/mutations.js";
import type * as notion_oauth from "../notion/oauth.js";
import type * as notion_queries from "../notion/queries.js";
import type * as notion_sync from "../notion/sync.js";
import type * as notion_types from "../notion/types.js";
import type * as utils_types from "../utils/types.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  files: typeof files;
  http: typeof http;
  ideas: typeof ideas;
  notion: typeof notion;
  "notion/api": typeof notion_api;
  "notion/client": typeof notion_client;
  "notion/index": typeof notion_index;
  "notion/mutations": typeof notion_mutations;
  "notion/oauth": typeof notion_oauth;
  "notion/queries": typeof notion_queries;
  "notion/sync": typeof notion_sync;
  "notion/types": typeof notion_types;
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
