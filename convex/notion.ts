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
  generateOAuthUrl,
  getConnectionStatus,
  getConnectionById,
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
  exchangeOAuthCode,
} from "./notion/actions";
