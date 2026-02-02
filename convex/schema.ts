import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    label: v.optional(
      v.union(
        v.literal("Requires Planning"),
        v.literal("Priority"),
        v.literal("Mid Priority"),
        v.literal("Strict deadline"),
        v.literal("Sponsored"),
        v.literal("High Effort"),
        v.literal("Worth it?"),
        v.literal("Evergreen"),
        v.literal("Database Week"),
      ),
    ),
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
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
    order: v.number(),
    notionPageId: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_column", ["userId", "column"])
    .index("by_organization", ["organizationId"])
    .index("by_organization_column", ["organizationId", "column"])
    .index("by_notion_page", ["notionPageId"]),

  // Notion connection per organization - admin pastes integration token
  notionConnections: defineTable({
    organizationId: v.string(),
    integrationToken: v.string(),
    createdBy: v.string(), // userId of admin who set it
    connectedAt: v.number(),
    databaseId: v.optional(v.string()),
    databaseName: v.optional(v.string()),
    targetSection: v.optional(v.string()),
    titlePropertyName: v.optional(v.string()),
    statusPropertyName: v.optional(v.string()),
    statusPropertyType: v.optional(v.union(v.literal("status"), v.literal("select"))),
    descriptionPropertyName: v.optional(v.string()),
  }).index("by_organization", ["organizationId"]),
});
