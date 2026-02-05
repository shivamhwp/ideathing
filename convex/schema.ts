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
    thumbnail: v.optional(v.union(v.string(), v.null())),
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
    syncedAt: v.optional(v.number()),
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
  }).index("by_organization", ["organizationId"]),

  ideaExports: defineTable({
    tokenHash: v.string(),
    token: v.optional(v.string()),
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
      thumbnail: v.optional(v.union(v.string(), v.null())),
      thumbnailReady: v.optional(v.boolean()),
      resources: v.optional(v.array(v.string())),
      vodRecordingDate: v.optional(v.string()),
      releaseDate: v.optional(v.string()),
      owner: v.optional(
        v.union(
          v.literal("Theo"),
          v.literal("Phase"),
          v.literal("Mir"),
          v.literal("flip"),
          v.literal("melkey"),
          v.literal("gabriel"),
          v.literal("ben"),
          v.literal("shivam"),
        ),
      ),
      channel: v.optional(
        v.union(
          v.literal("C:Main"),
          v.literal("C:Rants"),
          v.literal("C:Throwaways"),
          v.literal("C:Other"),
          v.literal("C:Main(SHORT)"),
        ),
      ),
      potential: v.optional(v.number()),
      label: v.optional(v.array(literalUnion(labelValues))),
      status: v.optional(
        v.union(
          v.literal("To Record(Off stream)"),
          v.literal("To Stream"),
          v.literal("Recorded"),
          v.literal("Editing"),
          v.literal("Done Editing"),
          v.literal("NEEDS THUMBNAIL"),
          v.literal("Ready To Publish"),
          v.literal("Scheduled"),
          v.literal("Published"),
          v.literal("Concept"),
          v.literal("Commited"),
          v.literal("dead"),
          v.literal("Shorts"),
          v.literal("2nd & 3rd Channel"),
          v.literal("Needs sponsor spot"),
          v.literal("Theo's Problem"),
          v.literal("archived"),
        ),
      ),
      adReadTracker: v.optional(v.string()),
      unsponsored: v.optional(v.boolean()),
      column: v.union(v.literal("Concept"), v.literal("To Stream")),
      order: v.number(),
    }),
  }).index("by_export", ["exportId"]),
});
