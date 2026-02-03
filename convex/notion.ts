// Re-export all notion module exports
export {
  // Queries
  getConnection,
  getConnectionInternal,
  listIdeasWithNotion,
  getIdeaByNotionPageId,
  getIdeaInternal,
  getConnectionByDatabaseId,
  // OAuth queries
  getConnectionStatus,
  getConnectionById,
  getOAuthStateByValue,
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
  createOAuthState,
  deleteOAuthState,
  // OAuth mutations
  saveOAuthConnection,
  updateConnectionTokens,
} from "./notion/mutations";

export {
  // Actions (Sync + API combined)
  syncToNotion,
  syncStatusesFromNotion,
  syncIdeaFromNotionPage,
  deleteFromNotion,
  updateInNotion,
  createIdeaFromNotionPage,
  handleNotionPageDeleted,
  syncFromDataSource,
  // API Actions
  listDatabases,
  getDataSourceSchema,
  // OAuth actions
  getValidToken,
  refreshOAuthToken,
  generateOAuthUrl,
  exchangeOAuthCode,
} from "./notion/actions";
