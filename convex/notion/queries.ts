import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { getModeForScope } from "../utils/mode";

const fetchOrgConnection = async (
  ctx: QueryCtx,
  organizationId: string,
): Promise<Doc<"notionConnections"> | null> => {
  const connections = await ctx.db
    .query("notionConnections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  const sorted = connections.sort((a, b) => b.connectedAt - a.connectedAt);
  const active = sorted.find(
    (connection) => connection.isActive !== false && Boolean(connection.accessToken),
  );
  return active ?? sorted[0] ?? null;
};

export const getConnectionInternal = internalQuery({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    return await fetchOrgConnection(ctx, args.organizationId);
  },
});

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
  handler: async (ctx) => {
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

export const getIdeaInternal = internalQuery({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ideaId);
  },
});
