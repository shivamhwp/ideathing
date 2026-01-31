import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
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

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.string()),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("idea"), v.literal("To Stream"), v.literal("Recorded")),
    ),
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
      status: args.status ?? "idea",
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

export const move = mutation({
  args: {
    id: v.id("ideas"),
    column: v.union(v.literal("ideas"), v.literal("vid-it")),
    order: v.number(),
    status: v.optional(v.union(v.literal("idea"), v.literal("To Stream"), v.literal("Recorded"))),
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
    const movingToVidIt = args.column === "vid-it";

    // Update the idea
    const nextStatus =
      args.status ??
      (idea.column === "ideas" && args.column === "vid-it"
        ? "To Stream"
        : idea.column === "vid-it" && args.column === "ideas"
          ? "idea"
          : idea.status);

    await ctx.db.patch(args.id, {
      column: args.column,
      order: args.order,
      status: nextStatus,
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

    // If moving from ideas to vid-it, sync to Notion
    if (wasInIdeas && movingToVidIt) {
      await ctx.scheduler.runAfter(0, internal.notion.syncToNotion, {
        ideaId: args.id,
      });
    }

    // If moving from vid-it to ideas, delete from Notion
    const wasInVidIt = idea.column === "vid-it";
    const movingToIdeas = args.column === "ideas";
    if (wasInVidIt && movingToIdeas && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, {
        ideaId: args.id,
      });
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("ideas"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    thumbnail: v.optional(v.union(v.string(), v.null())),
    clearThumbnail: v.optional(v.boolean()),
    thumbnailReady: v.optional(v.boolean()),
    resources: v.optional(v.array(v.string())),
    status: v.optional(
      v.union(v.literal("idea"), v.literal("To Stream"), v.literal("Recorded")),
    ),
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

    // If idea is in vid-it and has a Notion page, sync updates to Notion
    if (idea.column === "vid-it" && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.updateInNotion, {
        ideaId: args.id,
      });
    }
  },
});

export const remove = mutation({
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

    // If idea is in vid-it and has a Notion page, delete from Notion
    if (idea.column === "vid-it" && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, {
        ideaId: args.id,
      });
    }

    await ctx.db.delete(args.id);
  },
});
