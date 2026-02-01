import { v } from "convex/values";
import { action, mutation, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { createNotionClient } from "./client";
import { NOTION_VERSION } from "./types";

const encodeBasicAuth = (clientId: string, clientSecret: string) => {
  const bytes = new TextEncoder().encode(`${clientId}:${clientSecret}`);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

export const createOAuthState = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const state = crypto.randomUUID();
    await ctx.db.insert("notionOAuthStates", {
      userId: identity.subject,
      state,
      createdAt: Date.now(),
    });

    return { state };
  },
});

export const exchangeOAuthCode = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const stateRecord = await ctx.runQuery(internal.notion.getOAuthStateByState, {
      state: args.state,
    });

    if (!stateRecord || stateRecord.userId !== identity.subject) {
      throw new Error("Invalid or expired OAuth state.");
    }

    await ctx.runMutation(internal.notion.deleteOAuthState, {
      id: stateRecord._id,
    });

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing Notion OAuth environment variables.");
    }

    const basicAuth = encodeBasicAuth(clientId, clientSecret);
    const response = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_VERSION,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: redirectUri,
      }),
    });

    const data: unknown = await response.json();
    if (!response.ok) {
      const message =
        isRecord(data) && typeof data.message === "string"
          ? data.message
          : "Failed to exchange Notion OAuth code.";
      throw new Error(message);
    }

    const accessToken = isRecord(data) ? getString(data.access_token) : undefined;
    if (!accessToken) {
      throw new Error("Missing Notion access token.");
    }

    await ctx.runMutation(internal.notion.upsertConnectionFromOAuth, {
      userId: identity.subject,
      accessToken,
      workspaceId: isRecord(data) ? getString(data.workspace_id) : undefined,
      workspaceName: isRecord(data) ? getString(data.workspace_name) : undefined,
    });

    return { success: true };
  },
});

export const getOAuthStateByState = internalQuery({
  args: {
    state: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("notionOAuthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
  },
});

export const deleteOAuthState = internalMutation({
  args: {
    id: v.id("notionOAuthStates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const upsertConnectionFromOAuth = internalMutation({
  args: {
    userId: v.string(),
    accessToken: v.string(),
    workspaceId: v.optional(v.string()),
    workspaceName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const payload = {
      userId: args.userId,
      accessToken: args.accessToken,
      connectedAt: Date.now(),
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("notionConnections", payload);
    }
  },
});

export const fetchAndStoreBotId = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: identity.subject,
    });

    if (!connection) {
      throw new Error("Notion is not connected.");
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) {
      throw new Error("No Notion access token found.");
    }

    const notion = createNotionClient(accessToken);
    const botUser = await notion.users.me({});

    await ctx.runMutation(internal.notion.updateBotId, {
      connectionId: connection._id,
      botId: botUser.id,
    });

    return { botId: botUser.id };
  },
});

export const updateBotId = internalMutation({
  args: {
    connectionId: v.id("notionConnections"),
    botId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      botId: args.botId,
    });
  },
});
