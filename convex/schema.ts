import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { ownerValues, channelValues, labelValues, statusValues } from "../shared/idea-values";

const literalUnion = <T extends readonly string[]>(values: T) =>
  v.union(...values.map((value) => v.literal(value)));

export default defineSchema({
  ideas: defineTable({
    userId: v.string(),
    organizationId: v.optional(v.string()),
    title: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    draftThumbnail: v.optional(v.union(v.string(), v.null())),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    owner: v.optional(literalUnion(ownerValues)),
    channel: v.optional(literalUnion(channelValues)),
    potential: v.optional(v.number()),
    label: v.optional(v.array(literalUnion(labelValues))),
    status: v.optional(literalUnion(statusValues)),
    adReadTracker: v.optional(v.string()),
    unsponsored: v.optional(v.boolean()),
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
    order: v.number(),
    notionPageId: v.optional(v.string()),
    notionSynced: v.optional(v.boolean()),
    notionSyncInFlight: v.optional(v.boolean()),
    notionSyncInFlightAt: v.optional(v.number()),
    syncedAt: v.optional(v.number()),
    inNotion: v.optional(v.boolean()),
    notionSentAt: v.optional(v.number()),
    notionSendBy: v.optional(v.string()),
    notionSendState: v.optional(
      v.union(v.literal("idle"), v.literal("sending"), v.literal("sent"), v.literal("error")),
    ),
    notionSendError: v.optional(v.string()),
    importedFromExportId: v.optional(v.id("ideaExports")),
    importedFromOrganizationId: v.optional(v.string()),
    importedFromIdeaId: v.optional(v.id("ideas")),
    importedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_column", ["userId", "column"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_column", ["organizationId", "column"])
    .index("by_notion_page", ["notionPageId"]),

  modeSettings: defineTable({
    organizationId: v.string(),
    theoMode: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_organization", ["organizationId"]),

  userFlags: defineTable({
    userId: v.string(),
    canManageTheoMode: v.optional(v.boolean()),
    updatedAt: v.number(),
    updatedBy: v.string(),
  }).index("by_user", ["userId"]),

  notionOauthStates: defineTable({
    state: v.string(),
    userId: v.string(),
    organizationId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_expires_at", ["expiresAt"]),

  // Notion connection per organization - OAuth based
  notionConnections: defineTable({
    organizationId: v.string(),
    // OAuth tokens
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenType: v.string(), // "bearer"
    expiresAt: v.optional(v.number()), // estimated expiration timestamp
    lastRefreshedAt: v.optional(v.number()),
    // Notion workspace info
    botId: v.string(),
    workspaceId: v.string(),
    workspaceName: v.optional(v.string()),
    workspaceIcon: v.optional(v.string()),
    // Health status for revoked/removed integrations
    isActive: v.optional(v.boolean()),
    lastCheckedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    disconnectedAt: v.optional(v.number()),
    syncBackfillRunning: v.optional(v.boolean()),
    syncBackfillRequestedAt: v.optional(v.number()),
    syncBackfillCompletedAt: v.optional(v.number()),
    syncBackfillLastError: v.optional(v.string()),
    // Connection metadata
    createdBy: v.string(), // userId of admin who set it
    connectedAt: v.number(),
    // Database settings
    databaseId: v.optional(v.string()),
    databaseName: v.optional(v.string()),
    targetSection: v.optional(v.string()),
    titlePropertyName: v.optional(v.string()),
    statusPropertyName: v.optional(v.string()),
    statusPropertyType: v.optional(v.union(v.literal("status"), v.literal("select"))),
    descriptionPropertyName: v.optional(v.string()),
  })
    .index("by_organization", ["organizationId"])
    .index("by_database_id", ["databaseId"]),

  notionPageTombstones: defineTable({
    organizationId: v.string(),
    notionPageId: v.string(),
    deletedAt: v.number(),
    source: v.union(v.literal("app_delete"), v.literal("app_unlink")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_org_page", ["organizationId", "notionPageId"]),

  ideaExports: defineTable({
    tokenHash: v.string(),
    shareUrl: v.optional(v.string()),
    sourceOrganizationId: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    maxUses: v.number(),
    uses: v.number(),
    itemCount: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_token_hash", ["tokenHash"])
    .index("by_source_org", ["sourceOrganizationId"]),

  ideaExportItems: defineTable({
    exportId: v.id("ideaExports"),
    ideaId: v.id("ideas"),
    payload: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      notes: v.optional(v.string()),
      draftThumbnail: v.optional(v.union(v.string(), v.null())),
      thumbnailReady: v.optional(v.boolean()),
      resources: v.optional(v.array(v.string())),
      vodRecordingDate: v.optional(v.string()),
      releaseDate: v.optional(v.string()),
      owner: v.optional(literalUnion(ownerValues)),
      channel: v.optional(literalUnion(channelValues)),
      potential: v.optional(v.number()),
      label: v.optional(v.array(literalUnion(labelValues))),
      status: v.optional(literalUnion(statusValues)),
      adReadTracker: v.optional(v.string()),
      unsponsored: v.optional(v.boolean()),
      column: v.union(v.literal("Concept"), v.literal("To Stream")),
      order: v.number(),
    }),
  }).index("by_export", ["exportId"]),
});
