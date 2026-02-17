import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { query, internalQuery, type QueryCtx } from "../_generated/server";
import { getModeForScope } from "../utils/mode";

const fetchOrgConnection = async (
  ctx: QueryCtx,
  organizationId: string,
): Promise<Doc<"notionConnections"> | null> => {
  return await ctx.db
    .query("notionConnections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .first();
};

export const getConnection = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity?.org_id;
    if (!orgId) {
      return null;
    }
    const mode = await getModeForScope(ctx, { kind: "organization", id: orgId });
    if (mode !== "theo") {
      return null;
    }

    const connection = await fetchOrgConnection(ctx, orgId);
    if (!connection || !connection.accessToken || connection.isActive === false) {
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
    return await fetchOrgConnection(ctx, args.organizationId);
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

export const getOAuthStateByValue = internalQuery({
  args: {
    state: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notionOauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
  },
});

export const getConnectionStatus = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity?.org_id;
    if (!orgId) {
      return null;
    }
    const mode = await getModeForScope(ctx, { kind: "organization", id: orgId });
    if (mode !== "theo") {
      return null;
    }

    const connection = await fetchOrgConnection(ctx, orgId);
    if (!connection) {
      return null;
    }

    const isConnected = connection.isActive !== false && Boolean(connection.accessToken);

    return {
      isConnected,
      connectedAt: connection.connectedAt,
      databaseId: connection.databaseId,
      databaseName: connection.databaseName,
      workspaceName: connection.workspaceName,
      lastCheckedAt: connection.lastCheckedAt,
      lastError: connection.lastError,
      disconnectedAt: connection.disconnectedAt,
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

export const listToStreamIdeasNeedingSync = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_organization_column", (q) =>
        q.eq("organizationId", args.organizationId).eq("column", "To Stream"),
      )
      .collect();

    return ideas.filter((idea) => !(idea.notionSynced ?? Boolean(idea.notionPageId)));
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
    return await ctx.db
      .query("notionConnections")
      .withIndex("by_database_id", (q) => q.eq("databaseId", args.databaseId))
      .first();
  },
});
