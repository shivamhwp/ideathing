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
  // Sync
  syncToNotion,
  syncStatusesFromNotion,
  syncIdeaFromNotionPage,
  deleteFromNotion,
  updateInNotion,
  getIdeaInternal,
  listIdeasWithNotion,
  getIdeaByNotionPageId,
  updateIdeaSynced,
  clearIdeaSynced,
  updateIdeaFromNotion,
} from "./notion/sync";

export {
  // API
  getConnection,
  getConnectionInternal,
  listDatabases,
  getDataSourceSchema,
  saveDatabaseSettings,
  disconnect,
} from "./notion/api";
