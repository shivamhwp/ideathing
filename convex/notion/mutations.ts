import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, mutation, type MutationCtx } from "../_generated/server";
import { requireAuth } from "../helper";
import { assertOrgAdmin, getIdentityOrgId } from "../utils/auth";
import { isTheoModeForScope } from "../utils/mode";
import { normalizeNotionId } from "./utils/ids";

const disconnectNotionConnectionForOrg = async (
  ctx: Pick<MutationCtx, "db">,
  organizationId: string,
) => {
  const connections = await ctx.db
    .query("notionConnections")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .collect();
  const [connection, ...duplicates] = connections.sort((a, b) => b.connectedAt - a.connectedAt);

  if (!connection) {
    return;
  }

  const now = Date.now();
  await ctx.db.patch(connection._id, {
    isActive: false,
    disconnectedAt: now,
    lastCheckedAt: now,
    lastError: undefined,
    accessToken: "",
    refreshToken: undefined,
    expiresAt: undefined,
    lastRefreshedAt: undefined,
  });

  for (const duplicate of duplicates) {
    await ctx.db.delete(duplicate._id);
  }
};

export const saveDatabaseSettings = mutation({
  args: {
    databaseId: v.string(),
    databaseName: v.optional(v.string()),
    targetSection: v.optional(v.string()),
    titlePropertyName: v.optional(v.string()),
    statusPropertyName: v.optional(v.string()),
    statusPropertyType: v.optional(v.union(v.literal("status"), v.literal("select"))),
    descriptionPropertyName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const orgId = getIdentityOrgId(identity);
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can configure Notion");

    const theoModeEnabled = await isTheoModeForScope(ctx, {
      kind: "organization",
      id: orgId,
    });
    if (!theoModeEnabled) {
      throw new Error("Theo mode is disabled for this workspace");
    }

    const connections = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .collect();
    const [connection, ...duplicates] = connections.sort((a, b) => b.connectedAt - a.connectedAt);

    if (!connection) {
      throw new Error("Notion is not connected.");
    }

    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
    }

    const conflictingConnections = await ctx.db
      .query("notionConnections")
      .withIndex("by_database_id", (q) => q.eq("databaseId", args.databaseId))
      .filter((q) => q.neq(q.field("organizationId"), orgId))
      .collect();

    const hasActiveConflict = conflictingConnections.some(
      (record) => record.isActive !== false && Boolean(record.accessToken),
    );
    if (hasActiveConflict) {
      throw new Error("This Notion data source is already connected to another workspace.");
    }

    await ctx.db.patch(connection._id, {
      databaseId: args.databaseId,
      databaseName: args.databaseName?.trim() || undefined,
      targetSection: args.targetSection?.trim() || undefined,
      titlePropertyName: args.titlePropertyName?.trim() || "Name",
      statusPropertyName: args.statusPropertyName?.trim() || "Status",
      statusPropertyType: args.statusPropertyType ?? "status",
      descriptionPropertyName: args.descriptionPropertyName?.trim() || "Description",
    });
  },
});

export const disconnectLocal = internalMutation({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args) => {
    await disconnectNotionConnectionForOrg(ctx, args.organizationId);
  },
});

export const enqueueIdeaSend = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    actorUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) {
      return { queued: false as const, reason: "missing_idea" as const };
    }

    if (idea.inNotion) {
      return { queued: false as const, reason: "already_sent" as const };
    }

    if (idea.notionSendState === "sending") {
      return { queued: false as const, reason: "already_sending" as const };
    }

    await ctx.db.patch(args.ideaId, {
      notionSendState: "sending",
      notionSendError: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.notion.actions.processQueuedIdeaSend, {
      ideaId: args.ideaId,
      actorUserId: args.actorUserId,
      attempt: 0,
    });

    return { queued: true as const };
  },
});

export const markIdeaSendSuccess = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    userId: v.string(),
    notionPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      inNotion: true,
      notionSentAt: Date.now(),
      notionSendBy: args.userId,
      notionSendState: "sent",
      notionSendError: undefined,
      notionPageId: args.notionPageId ? normalizeNotionId(args.notionPageId) : undefined,
    });
  },
});

export const markIdeaSendFailure = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea || idea.inNotion) {
      return;
    }

    await ctx.db.patch(args.ideaId, {
      notionSendState: "error",
      notionSendError: args.error?.slice(0, 400) ?? "Failed to send to Notion",
    });
  },
});

export const createOAuthState = internalMutation({
  args: {
    state: v.string(),
    userId: v.string(),
    organizationId: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notionOauthStates", {
      state: args.state,
      userId: args.userId,
      organizationId: args.organizationId,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
    });
  },
});

export const deleteOAuthState = internalMutation({
  args: {
    stateId: v.id("notionOauthStates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.stateId);
  },
});

export const saveOAuthConnection = internalMutation({
  args: {
    userId: v.string(),
    organizationId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenType: v.string(),
    botId: v.string(),
    workspaceId: v.string(),
    workspaceName: v.optional(v.string()),
    workspaceIcon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingConnections = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    const [existing, ...duplicates] = existingConnections.sort(
      (a, b) => b.connectedAt - a.connectedAt,
    );
    const wasDisconnected = Boolean(
      existing && (existing.isActive === false || existing.disconnectedAt),
    );

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    const connectionData = {
      organizationId: args.organizationId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenType: args.tokenType,
      botId: args.botId,
      workspaceId: args.workspaceId,
      workspaceName: args.workspaceName,
      workspaceIcon: args.workspaceIcon,
      createdBy: args.userId,
      connectedAt: now,
      lastRefreshedAt: now,
      expiresAt,
      isActive: true,
      lastCheckedAt: now,
      lastError: undefined,
      disconnectedAt: undefined,
    };

    if (existing) {
      await ctx.db.patch(existing._id, connectionData);
    } else {
      await ctx.db.insert("notionConnections", connectionData);
    }

    for (const duplicate of duplicates) {
      await ctx.db.delete(duplicate._id);
    }

    return { success: true, wasDisconnected };
  },
});

export const updateConnectionTokens = internalMutation({
  args: {
    connectionId: v.id("notionConnections"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      lastRefreshedAt: now,
      expiresAt,
      isActive: true,
      lastCheckedAt: now,
      lastError: undefined,
      disconnectedAt: undefined,
    });

    return { success: true };
  },
});

export const updateConnectionHealth = internalMutation({
  args: {
    connectionId: v.id("notionConnections"),
    isActive: v.boolean(),
    checkedAt: v.number(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.connectionId, {
      isActive: args.isActive,
      lastCheckedAt: args.checkedAt,
      lastError: args.error,
      disconnectedAt: args.isActive ? undefined : args.checkedAt,
    });
  },
});
