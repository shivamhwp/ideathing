import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const isStorageId = (value: string | null | undefined): value is string =>
  !!value && value.startsWith("k") && !value.includes("://");

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();

    return ideas;
  },
});

export const get = query({
  args: {
    id: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const idea = await ctx.db.get(args.id);
    if (!idea || idea.userId !== identity.subject) {
      return null;
    }

    return idea;
  },
});

export const listRecorded = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("recorded"), true))
      .collect();

    return ideas;
  },
});

export const listByColumn = query({
  args: {
    column: v.union(v.literal("ideas"), v.literal("to-stream")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user_column", (q) =>
        q.eq("userId", identity.subject).eq("column", args.column),
      )
      .collect();

    return ideas.sort((a, b) => a.order - b.order);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    owner: v.optional(v.union(v.literal("Theo"), v.literal("Phase"), v.literal("Ben"))),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways")),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_user_column", (q) => q.eq("userId", identity.subject).eq("column", "ideas"))
      .collect();

    const maxOrder = existingIdeas.reduce((max, idea) => Math.max(max, idea.order), -1);

    const ideaId = await ctx.db.insert("ideas", {
      userId: identity.subject,
      title: args.title,
      description: args.description,
      notes: args.notes,
      thumbnail: args.thumbnail,
      thumbnailReady: args.thumbnailReady ?? false,
      resources: args.resources,
      recorded: false,
      vodRecordingDate: args.vodRecordingDate,
      releaseDate: args.releaseDate,
      owner: args.owner,
      channel: args.channel,
      potential: args.potential,
      label: args.label,
      adReadTracker: args.adReadTracker,
      unsponsored: args.unsponsored ?? true,
      column: "ideas",
      order: maxOrder + 1,
    });

    return ideaId;
  },
});

export const moveInternal = internalMutation({
  args: {
    id: v.id("ideas"),
    column: v.union(v.literal("ideas"), v.literal("to-stream")),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea || idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    const wasInIdeas = idea.column === "ideas";
    const wasInToStream = idea.column === "to-stream";
    const movingToToStream = args.column === "to-stream";
    const movingToIdeas = args.column === "ideas";

    await ctx.db.patch(args.id, {
      column: args.column,
      order: args.order,
    });

    // Reorder other items in the target column
    const columnIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_user_column", (q) =>
        q.eq("userId", identity.subject).eq("column", args.column),
      )
      .collect();

    // Sort and reorder
    const sortedIdeas = columnIdeas
      .filter((i) => i._id !== args.id)
      .sort((a, b) => a.order - b.order);

    for (let i = 0; i < sortedIdeas.length; i++) {
      const newOrder = i >= args.order ? i + 1 : i;
      if (sortedIdeas[i].order !== newOrder) {
        await ctx.db.patch(sortedIdeas[i]._id, { order: newOrder });
      }
    }

    return {
      wasInIdeas,
      movingToToStream,
      wasInToStream,
      movingToIdeas,
      notionPageId: idea.notionPageId ?? null,
    };
  },
});

export const move = action({
  args: {
    id: v.id("ideas"),
    column: v.union(v.literal("ideas"), v.literal("to-stream")),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.ideas.moveInternal, args);

    if (result.wasInIdeas && result.movingToToStream) {
      await ctx.runAction(internal.notion.syncToNotion, { ideaId: args.id });
    }

    if (result.wasInToStream && result.movingToIdeas && result.notionPageId) {
      await ctx.runAction(internal.notion.deleteFromNotion, { ideaId: args.id });
    }
  },
});

export const updateInternal = internalMutation({
  args: {
    id: v.id("ideas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.union(v.string(), v.null())),
    clearThumbnail: v.optional(v.boolean()),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    recorded: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    owner: v.optional(v.union(v.literal("Theo"), v.literal("Phase"), v.literal("Ben"))),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways")),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea || idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    const { id, clearThumbnail, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    const wantsThumbnailChange = args.thumbnail !== undefined || clearThumbnail === true;
    if (wantsThumbnailChange) {
      const nextThumbnail = clearThumbnail ? null : (args.thumbnail ?? null);
      if (isStorageId(idea.thumbnail)) {
        const nextStorageId = typeof nextThumbnail === "string" ? nextThumbnail : null;
        if (nextStorageId !== idea.thumbnail) {
          await ctx.storage.delete(idea.thumbnail as Id<"_storage">);
        }
      }
      filteredUpdates.thumbnail = nextThumbnail;
    }

    await ctx.db.patch(id, filteredUpdates);

    return {
      shouldSyncToNotion: idea.column === "to-stream" && !!idea.notionPageId,
    };
  },
});

export const update = action({
  args: {
    id: v.id("ideas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.union(v.string(), v.null())),
    clearThumbnail: v.optional(v.boolean()),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    recorded: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    owner: v.optional(v.union(v.literal("Theo"), v.literal("Phase"), v.literal("Ben"))),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways")),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.ideas.updateInternal, args);

    if (result.shouldSyncToNotion) {
      await ctx.runAction(internal.notion.updateInNotion, { ideaId: args.id });
    }
  },
});

export const removeInternal = internalMutation({
  args: {
    id: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea || idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    if (isStorageId(idea.thumbnail)) {
      await ctx.storage.delete(idea.thumbnail as Id<"_storage">);
    }

    const shouldDeleteFromNotion = idea.column === "to-stream" && !!idea.notionPageId;

    await ctx.db.delete(args.id);

    return {
      shouldDeleteFromNotion,
      notionPageId: idea.notionPageId ?? null,
      userId: idea.userId,
    };
  },
});

export const remove = action({
  args: {
    id: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runMutation(internal.ideas.removeInternal, args);

    if (result.shouldDeleteFromNotion && result.notionPageId) {
      await ctx.runAction(internal.notion.deleteFromNotion, {
        ideaId: args.id,
        userId: result.userId,
        notionPageId: result.notionPageId,
      });
    }
  },
});
