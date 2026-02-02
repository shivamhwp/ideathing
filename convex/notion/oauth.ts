import { v } from "convex/values";
import { mutation, query, action } from "../_generated/server";
import { createNotionClient } from "./client";

// Save integration token - organizationId passed from frontend (Clerk provides it)
export const saveIntegrationToken = mutation({
  args: {
    organizationId: v.string(),
    integrationToken: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if connection already exists for this org
    const existing = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        integrationToken: args.integrationToken,
        createdBy: identity.subject,
        connectedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("notionConnections", {
        organizationId: args.organizationId,
        integrationToken: args.integrationToken,
        createdBy: identity.subject,
        connectedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

// Test connection by calling Notion API
export const testConnection = action({
  args: {
    integrationToken: v.string(),
  },
  handler: async (_ctx, args) => {
    try {
      const notion = createNotionClient(args.integrationToken);
      const user = await notion.users.me({});
      return {
        success: true,
        workspaceName: user.name ?? "Connected",
        botId: user.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect",
      };
    }
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
    };
  },
});
