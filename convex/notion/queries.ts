import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

export const getConnection = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const orgId = args.organizationId;
    if (!orgId) {
      return null;
    }

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    if (!connection || !connection.integrationToken) {
      return null;
    }

    return {
      databaseId: connection.databaseId,
      databaseName: connection.databaseName,
      targetSection: connection.targetSection,
      titlePropertyName: connection.titlePropertyName,
      statusPropertyName: connection.statusPropertyName,
      statusPropertyType: connection.statusPropertyType,
      descriptionPropertyName: connection.descriptionPropertyName,
    };
  },
});

export const getConnectionInternal = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();
  },
});

export const listIdeasWithNotion = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return ideas.filter((idea) => Boolean(idea.notionPageId));
  },
});

export const getIdeaByNotionPageId = internalQuery({
  args: {
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_notion_page", (q) => q.eq("notionPageId", args.notionPageId))
      .first();
  },
});

export const getIdeaInternal = internalQuery({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ideaId);
  },
});

export const getConnectionByDatabaseId = internalQuery({
  args: {
    databaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedId = args.databaseId.replace(/-/g, "");

    const connections = await ctx.db.query("notionConnections").collect();

    for (const connection of connections) {
      if (!connection.databaseId) continue;
      const connDbId = connection.databaseId.replace(/-/g, "");
      if (connDbId === normalizedId || connection.databaseId === args.databaseId) {
        return connection;
      }
    }

    return null;
  },
});
