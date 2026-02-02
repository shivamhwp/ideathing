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

    if (!connection || !connection.accessToken) {
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

// Get connection by ID (internal use)
export const getConnectionById = internalQuery({
  args: {
    connectionId: v.id("notionConnections"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.connectionId);
  },
});

// Generate OAuth URL for frontend
export const generateOAuthUrl = query({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("OAuth not configured");
    }

    // State includes userId and organizationId for callback
    const state = `${identity.subject}:${args.organizationId}`;

    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return authUrl.toString();
  },
});

// Get connection status - organizationId passed from frontend
export const getConnectionStatus = query({
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

    if (!connection) {
      return null;
    }

    return {
      isConnected: true,
      connectedAt: connection.connectedAt,
      databaseId: connection.databaseId,
      databaseName: connection.databaseName,
      workspaceName: connection.workspaceName,
    };
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
