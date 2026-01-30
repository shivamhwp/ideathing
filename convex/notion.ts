import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalAction,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";

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

    // Don't return the token to the client
    return {
      databaseId: connection.databaseId,
      targetSection: connection.targetSection,
    };
  },
});

export const connect = mutation({
  args: {
    integrationToken: v.string(),
    databaseId: v.string(),
    targetSection: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Delete existing connection if any
    const existing = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Create new connection
    await ctx.db.insert("notionConnections", {
      userId: identity.subject,
      integrationToken: args.integrationToken,
      databaseId: args.databaseId,
      targetSection: args.targetSection,
    });
  },
});

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (connection) {
      await ctx.db.delete(connection._id);
    }
  },
});

export const testConnection = mutation({
  args: {
    integrationToken: v.string(),
    databaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // We'll do a simple validation here and let the action do the real test
    if (!args.integrationToken.startsWith("ntn_") && !args.integrationToken.startsWith("secret_")) {
      return {
        success: false,
        error: "Invalid integration token format. It should start with 'ntn_'",
      };
    }

    if (args.databaseId.length < 32) {
      return {
        success: false,
        error: "Invalid database ID format",
      };
    }

    // For now, just return success - the actual API call will happen in the action
    return { success: true };
  },
});

// Internal action to sync to Notion
export const syncToNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    // Get the idea
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea) {
      console.error("Idea not found:", args.ideaId);
      return;
    }

    // Get the connection
    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    if (!connection) {
      console.log("No Notion connection for user:", idea.userId);
      return;
    }

    try {
      // Call Notion API to create a page
      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.integrationToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          parent: {
            database_id: connection.databaseId,
          },
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: idea.title,
                  },
                },
              ],
            },
            Status: {
              select: {
                name: connection.targetSection,
              },
            },
            ...(idea.description && {
              Description: {
                rich_text: [
                  {
                    text: {
                      content: idea.description,
                    },
                  },
                ],
              },
            }),
          },
          children: idea.resources
            ? idea.resources.map((url) => ({
                object: "block",
                type: "bookmark",
                bookmark: {
                  url,
                },
              }))
            : [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Notion API error:", errorData);
        return;
      }

      const data = await response.json();

      // Update the idea with the Notion page ID
      await ctx.runMutation(internal.notion.updateIdeaSynced, {
        ideaId: args.ideaId,
        notionPageId: data.id,
      });

      console.log("Successfully synced idea to Notion:", data.id);
    } catch (error) {
      console.error("Failed to sync to Notion:", error);
    }
  },
});

// Internal query to get idea
export const getIdeaInternal = internalQuery({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ideaId);
  },
});

// Internal query to get connection
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

// Internal mutation to mark idea as synced
export const updateIdeaSynced = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      notionPageId: args.notionPageId,
      syncedAt: Date.now(),
    });
  },
});

// Internal action to delete from Notion
export const deleteFromNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    // Get the idea
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea || !idea.notionPageId) {
      console.log("No Notion page to delete for idea:", args.ideaId);
      return;
    }

    // Get the connection
    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    if (!connection) {
      console.log("No Notion connection for user:", idea.userId);
      return;
    }

    try {
      // Call Notion API to archive/delete the page
      const response = await fetch(`https://api.notion.com/v1/pages/${idea.notionPageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${connection.integrationToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          archived: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Notion API error:", errorData);
        return;
      }

      // Clear the Notion sync data from the idea
      await ctx.runMutation(internal.notion.clearIdeaSynced, {
        ideaId: args.ideaId,
      });

      console.log("Successfully deleted idea from Notion:", idea.notionPageId);
    } catch (error) {
      console.error("Failed to delete from Notion:", error);
    }
  },
});

// Internal mutation to clear Notion sync data
export const clearIdeaSynced = internalMutation({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      notionPageId: undefined,
      syncedAt: undefined,
    });
  },
});

// Internal action to update Notion page
export const updateInNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    // Get the idea
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea || !idea.notionPageId) {
      console.log("No Notion page to update for idea:", args.ideaId);
      return;
    }

    // Get the connection
    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    if (!connection) {
      console.log("No Notion connection for user:", idea.userId);
      return;
    }

    try {
      // Call Notion API to update the page properties
      const response = await fetch(`https://api.notion.com/v1/pages/${idea.notionPageId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${connection.integrationToken}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28",
        },
        body: JSON.stringify({
          properties: {
            Name: {
              title: [
                {
                  text: {
                    content: idea.title,
                  },
                },
              ],
            },
            ...(idea.description && {
              Description: {
                rich_text: [
                  {
                    text: {
                      content: idea.description,
                    },
                  },
                ],
              },
            }),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Notion API error:", errorData);
        return;
      }

      // Update syncedAt timestamp
      await ctx.runMutation(internal.notion.updateIdeaSynced, {
        ideaId: args.ideaId,
        notionPageId: idea.notionPageId,
      });

      console.log("Successfully updated idea in Notion:", idea.notionPageId);
    } catch (error) {
      console.error("Failed to update in Notion:", error);
    }
  },
});
