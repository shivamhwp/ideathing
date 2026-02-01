// Re-export all notion module exports for backwards compatibility
export {
  // OAuth
  createOAuthState,
  exchangeOAuthCode,
  getOAuthStateByState,
  deleteOAuthState,
  upsertConnectionFromOAuth,
  fetchAndStoreBotId,
  updateBotId,
} from "./notion/oauth";

export {
  // Queries
  getConnection,
  getConnectionInternal,
  listIdeasWithNotion,
  getIdeaByNotionPageId,
  getIdeaInternal,
  getConnectionByDatabaseId,
} from "./notion/queries";

export {
  // Mutations
  saveDatabaseSettings,
  disconnect,
  updateIdeaSynced,
  clearIdeaSynced,
  updateIdeaFromNotion,
  createIdeaFromWebhook,
  archiveIdeaFromNotion,
} from "./notion/mutations";

export {
  // Sync (Actions)
  syncToNotion,
  syncStatusesFromNotion,
  syncIdeaFromNotionPage,
  deleteFromNotion,
  updateInNotion,
  createIdeaFromNotionPage,
  handleNotionPageDeleted,
  syncFromDataSource,
} from "./notion/sync";

export {
  // API (Actions)
  listDatabases,
  getDataSourceSchema,
} from "./notion/api";
