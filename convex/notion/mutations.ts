import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

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

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
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

    const connection = await ctx.db
      .query("notionConnections")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();

    if (connection) {
      await ctx.db.delete(connection._id);
    }

    const states = await ctx.db
      .query("notionOAuthStates")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    for (const state of states) {
      await ctx.db.delete(state._id);
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
    recorded: v.optional(v.boolean()),
    column: v.optional(v.union(v.literal("ideas"), v.literal("to-stream"))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    owner: v.optional(
      v.union(
        v.literal("Theo"),
        v.literal("Phase"),
        v.literal("Ben"),
        v.literal("shivam"),
      ),
    ),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways"))
    ),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority")
      )
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done"))
    ),
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
        recorded: args.recorded,
        title: args.title,
        description: args.description,
        notes: args.notes,
        owner: args.owner,
        channel: args.channel,
        label: args.label,
        adReadTracker: args.adReadTracker,
        potential: args.potential,
        thumbnailReady: args.thumbnailReady,
        unsponsored: args.unsponsored,
        vodRecordingDate: args.vodRecordingDate,
        releaseDate: args.releaseDate,
      }).filter(([_, value]) => value !== undefined)
    );

    let nextColumn: "ideas" | "to-stream" | undefined;
    let nextOrder: number | undefined;

    // Handle column change from Notion
    if (args.column && args.column !== idea.column) {
      nextColumn = args.column;
    }

    if (nextColumn) {
      const columnIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) =>
          q.eq("userId", idea.userId).eq("column", nextColumn),
        )
        .collect();
      const maxOrder = columnIdeas.reduce((max, entry) => Math.max(max, entry.order), -1);
      nextOrder = maxOrder + 1;
    }

    const updatesWithColumn = Object.fromEntries(
      Object.entries({
        ...updates,
        column: nextColumn,
        order: nextOrder,
      }).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(updatesWithColumn).length === 0) {
      return;
    }

    await ctx.db.patch(args.ideaId, updatesWithColumn);
  },
});
