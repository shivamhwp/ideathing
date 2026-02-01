import { v } from "convex/values";
import { query, internalQuery } from "../_generated/server";

export const getConnection = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (!connection) {
      return null;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) {
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
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const listIdeasWithNotion = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
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
