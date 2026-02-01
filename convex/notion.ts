// Re-export all notion module exports for backwards compatibility
export {
  // OAuth
  createOAuthState,
  exchangeOAuthCode,
  getOAuthStateByState,
  deleteOAuthState,
  upsertConnectionFromOAuth,
} from "./notion/oauth";

export {
  // Queries
  getConnection,
  getConnectionInternal,
  listIdeasWithNotion,
  getIdeaByNotionPageId,
  getIdeaInternal,
} from "./notion/queries";

export {
  // Mutations
  saveDatabaseSettings,
  disconnect,
  updateIdeaSynced,
  clearIdeaSynced,
  updateIdeaFromNotion,
} from "./notion/mutations";

export {
  // Sync (Actions)
  syncToNotion,
  syncStatusesFromNotion,
  syncIdeaFromNotionPage,
  deleteFromNotion,
  updateInNotion,
} from "./notion/sync";

export {
  // API (Actions)
  listDatabases,
  getDataSourceSchema,
} from "./notion/api";
