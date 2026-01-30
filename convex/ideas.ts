import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

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
    thumbnail: v.optional(v.string()),
    resources: v.optional(v.array(v.string())),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    sponsored: v.optional(v.boolean()),
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
      thumbnail: args.thumbnail,
      resources: args.resources,
      priority: args.priority,
      sponsored: args.sponsored,
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
    thumbnail: v.optional(v.string()),
    resources: v.optional(v.array(v.string())),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    sponsored: v.optional(v.boolean()),
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

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

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

    // If idea is in vid-it and has a Notion page, delete from Notion
    if (idea.column === "vid-it" && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, {
        ideaId: args.id,
      });
    }

    await ctx.db.delete(args.id);
  },
});
