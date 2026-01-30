import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ideas: defineTable({
    userId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    resources: v.optional(v.array(v.string())),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    sponsored: v.optional(v.boolean()),
    column: v.union(v.literal("ideas"), v.literal("vid-it")),
    order: v.number(),
    notionPageId: v.optional(v.string()),
    syncedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_column", ["userId", "column"]),

  notionConnections: defineTable({
    userId: v.string(),
    integrationToken: v.string(),
    databaseId: v.string(),
    targetSection: v.string(),
  }).index("by_user", ["userId"]),
});
