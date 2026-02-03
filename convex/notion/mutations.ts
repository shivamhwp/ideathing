import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";
import {
  ownerValues,
  channelValues,
  labelValues,
  statusValues,
  adReadTrackerValues,
} from "../utils/types";
import { assertOrgAdmin } from "../utils/auth";

// Create case-insensitive lookup maps
const createLookup = <T extends readonly string[]>(values: T) => {
  const map = new Map(values.map((v) => [v.toLowerCase(), v]));
  return (value?: string | null): T[number] | undefined => {
    if (!value) return undefined;
    return map.get(value.toLowerCase()) as T[number] | undefined;
  };
};

const normalizeOwner = createLookup(ownerValues);
const normalizeChannel = createLookup(channelValues);
const normalizeLabel = createLookup(labelValues);
const normalizeStatus = createLookup(statusValues);
const normalizeAdReadTracker = createLookup(adReadTrackerValues);

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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const orgId = getIdentityOrgId(identity);
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can configure Notion");

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    if (!connection) {
      throw new Error("Notion is not connected.");
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

export const disconnect = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const orgId = getIdentityOrgId(identity);
    if (!orgId) {
      throw new Error("No organization context");
    }

    assertOrgAdmin(identity, "Only organization admins can disconnect Notion");

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
      .first();

    if (connection) {
      await ctx.db.delete(connection._id);
    }
  },
});

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

export const updateIdeaFromNotion = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    status: v.optional(v.string()),
    column: v.optional(v.union(v.literal("Concept"), v.literal("To Stream"))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    owner: v.optional(v.string()),
    channel: v.optional(v.string()),
    label: v.optional(v.string()),
    adReadTracker: v.optional(v.string()),
    potential: v.optional(v.number()),
    thumbnailReady: v.optional(v.boolean()),
    unsponsored: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) {
      return;
    }

    const updates = Object.fromEntries(
      Object.entries({
        status: normalizeStatus(args.status),
        title: args.title,
        description: args.description,
        notes: args.notes,
        owner: normalizeOwner(args.owner),
        channel: normalizeChannel(args.channel),
        label: normalizeLabel(args.label),
        adReadTracker: normalizeAdReadTracker(args.adReadTracker),
        potential: args.potential,
        thumbnailReady: args.thumbnailReady,
        unsponsored: args.unsponsored,
        vodRecordingDate: args.vodRecordingDate,
        releaseDate: args.releaseDate,
      }).filter(([_, value]) => value !== undefined),
    );

    let nextColumn: "Concept" | "To Stream" | undefined;
    let nextOrder: number | undefined;

    // Handle column change from Notion
    if (args.column && args.column !== idea.column) {
      nextColumn = args.column;
    }

    if (nextColumn) {
      const columnIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) => q.eq("userId", idea.userId).eq("column", nextColumn))
        .collect();
      const maxOrder = columnIdeas.reduce((max, entry) => Math.max(max, entry.order), -1);
      nextOrder = maxOrder + 1;
    }

    const updatesWithColumn = Object.fromEntries(
      Object.entries({
        ...updates,
        column: nextColumn,
        order: nextOrder,
      }).filter(([_, value]) => value !== undefined),
    );

    if (Object.keys(updatesWithColumn).length === 0) {
      return;
    }

    await ctx.db.patch(args.ideaId, updatesWithColumn);
  },
});

export const createIdeaFromWebhook = internalMutation({
  args: {
    organizationId: v.string(),
    userId: v.string(),
    notionPageId: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
    owner: v.optional(v.string()),
    channel: v.optional(v.string()),
    label: v.optional(v.string()),
    adReadTracker: v.optional(v.string()),
    potential: v.optional(v.number()),
    thumbnailReady: v.optional(v.boolean()),
    unsponsored: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingIdea = await ctx.db
      .query("ideas")
      .withIndex("by_notion_page", (q) => q.eq("notionPageId", args.notionPageId))
      .first();

    if (existingIdea) {
      return existingIdea._id;
    }

    const columnIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_organization_column", (q) =>
        q.eq("organizationId", args.organizationId).eq("column", args.column),
      )
      .collect();
    const maxOrder = columnIdeas.reduce((max, idea) => Math.max(max, idea.order), -1);

    const ideaId = await ctx.db.insert("ideas", {
      userId: args.userId,
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      notes: args.notes,
      status: normalizeStatus(args.status),
      column: args.column,
      order: maxOrder + 1,
      owner: normalizeOwner(args.owner),
      channel: normalizeChannel(args.channel),
      label: normalizeLabel(args.label),
      adReadTracker: normalizeAdReadTracker(args.adReadTracker),
      potential: args.potential,
      thumbnailReady: args.thumbnailReady ?? false,
      unsponsored: args.unsponsored,
      vodRecordingDate: args.vodRecordingDate,
      releaseDate: args.releaseDate,
      notionPageId: args.notionPageId,
      syncedAt: Date.now(),
    });

    return ideaId;
  },
});

export const archiveIdeaFromNotion = internalMutation({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) {
      return;
    }

    await ctx.db.patch(args.ideaId, {
      status: "archived",
      notionPageId: undefined,
      syncedAt: undefined,
    });
  },
});

// Save OAuth connection to database
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
    // Check if connection already exists for this org
    const existing = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .first();

    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000; // 90 days conservative estimate

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
      expiresAt: expiresAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, connectionData);
    } else {
      await ctx.db.insert("notionConnections", connectionData);
    }

    return { success: true };
  },
});

// Update connection tokens after refresh
export const updateConnectionTokens = internalMutation({
  args: {
    connectionId: v.id("notionConnections"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expiresAt = now + 90 * 24 * 60 * 60 * 1000; // 90 days

    await ctx.db.patch(args.connectionId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      lastRefreshedAt: now,
      expiresAt: expiresAt,
    });

    return { success: true };
  },
});
