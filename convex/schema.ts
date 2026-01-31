import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ideas: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.union(v.string(), v.null())),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    recorded: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    owner: v.optional(
      v.union(
        v.literal("Theo"),
        v.literal("Phase"),
        v.literal("Ben"),
        v.literal("shivam"),
      ),
    ),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways")),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
    column: v.union(v.literal("ideas"), v.literal("to-stream")),
    order: v.number(),
    notionPageId: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_column", ["userId", "column"])
    .index("by_notion_page", ["notionPageId"]),

  notionConnections: defineTable({
    userId: v.string(),
    accessToken: v.optional(v.string()),
    integrationToken: v.optional(v.string()),
    connectedAt: v.optional(v.number()),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
    databaseId: v.optional(v.string()),
    databaseName: v.optional(v.string()),
    targetSection: v.optional(v.string()),
    titlePropertyName: v.optional(v.string()),
    statusPropertyName: v.optional(v.string()),
    statusPropertyType: v.optional(v.union(v.literal("status"), v.literal("select"))),
    descriptionPropertyName: v.optional(v.string()),
  }).index("by_user", ["userId"]),

  notionOAuthStates: defineTable({
    userId: v.string(),
    state: v.string(),
    createdAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_user", ["userId"]),
});
