import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

const isStorageId = (value: string | null | undefined): value is string =>
  !!value && value.startsWith("k") && !value.includes("://");

export const list = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // If organizationId provided, get team ideas; otherwise get personal ideas
    if (args.organizationId) {
      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      return ideas;
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) => q.eq(q.field("organizationId"), undefined))
      .collect();

    return ideas;
  },
});

export const get = query({
  args: {
    id: v.id("ideas"),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const idea = await ctx.db.get(args.id);
    if (!idea) {
      return null;
    }

    // If idea belongs to an organization, check org access
    if (idea.organizationId) {
      // Allow access if caller is requesting with matching org ID
      // (Clerk JWT validates org membership on the frontend)
      if (args.organizationId === idea.organizationId) {
        return idea;
      }
      return null;
    }

    // Personal idea - check user ownership
    if (idea.userId !== identity.subject) {
      return null;
    }

    return idea;
  },
});

export const listRecorded = query({
  args: {
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    if (args.organizationId) {
      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) => q.eq(q.field("status"), "Recorded"))
        .collect();
      return ideas;
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .filter((q) =>
        q.and(q.eq(q.field("status"), "Recorded"), q.eq(q.field("organizationId"), undefined)),
      )
      .collect();

    return ideas;
  },
});

export const listByColumn = query({
  args: {
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    if (args.organizationId) {
      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", args.organizationId).eq("column", args.column),
        )
        .collect();
      return ideas.sort((a, b) => a.order - b.order);
    }

    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user_column", (q) =>
        q.eq("userId", identity.subject).eq("column", args.column),
      )
      .filter((q) => q.eq(q.field("organizationId"), undefined))
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
    owner: v.optional(
      v.union(
        v.literal("Theo"),
        v.literal("Phase"),
        v.literal("Mir"),
        v.literal("flip"),
        v.literal("melkey"),
        v.literal("gabriel"),
        v.literal("ben"),
        v.literal("shivam"),
      ),
    ),
    channel: v.optional(
      v.union(
        v.literal("C:Main"),
        v.literal("C:Rants"),
        v.literal("C:Throwaways"),
        v.literal("C:Other"),
        v.literal("C:Main(SHORT)"),
      ),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("Requires Planning"),
        v.literal("Priority"),
        v.literal("Mid Priority"),
        v.literal("Strict deadline"),
        v.literal("Sponsored"),
        v.literal("High Effort"),
        v.literal("Worth it?"),
        v.literal("Evergreen"),
        v.literal("Database Week"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("To Record(Off stream)"),
        v.literal("To Stream"),
        v.literal("Recorded"),
        v.literal("Editing"),
        v.literal("Done Editing"),
        v.literal("NEEDS THUMBNAIL"),
        v.literal("Ready To Publish"),
        v.literal("Scheduled"),
        v.literal("Published"),
        v.literal("Concept"),
        v.literal("Commited"),
        v.literal("dead"),
        v.literal("Shorts"),
        v.literal("2nd & 3rd Channel"),
        v.literal("Needs sponsor spot"),
        v.literal("Theo's Problem"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get existing ideas for order calculation based on org or personal
    let existingIdeas;
    if (args.organizationId) {
      existingIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", args.organizationId).eq("column", "Concept"),
        )
        .collect();
    } else {
      existingIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) =>
          q.eq("userId", identity.subject).eq("column", "Concept"),
        )
        .filter((q) => q.eq(q.field("organizationId"), undefined))
        .collect();
    }

    const maxOrder = existingIdeas.reduce((max, idea) => Math.max(max, idea.order), -1);

    const ideaId = await ctx.db.insert("ideas", {
      userId: identity.subject,
      organizationId: args.organizationId,
      title: args.title,
      description: args.description,
      notes: args.notes,
      thumbnail: args.thumbnail,
      thumbnailReady: args.thumbnailReady ?? false,
      resources: args.resources,

      vodRecordingDate: args.vodRecordingDate,
      releaseDate: args.releaseDate,
      owner: args.owner,
      channel: args.channel,
      potential: args.potential,
      label: args.label,
      status: args.status,
      adReadTracker: args.adReadTracker,
      unsponsored: args.unsponsored ?? true,
      column: "Concept",
      order: maxOrder + 1,
    });

    return ideaId;
  },
});

export const move = mutation({
  args: {
    id: v.id("ideas"),
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
    order: v.number(),
    status: v.optional(v.union(v.literal("To Stream"), v.literal("Concept"))),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea) {
      throw new Error("Idea not found");
    }

    // Check access: org idea requires matching orgId, personal requires user ownership
    if (idea.organizationId) {
      if (args.organizationId !== idea.organizationId) {
        throw new Error("Idea not found");
      }
    } else if (idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    const wasInConcept = idea.column === "Concept";
    const wasInToStream = idea.column === "To Stream";
    const movingToToStream = args.column === "To Stream";
    const movingToConcept = args.column === "Concept";

    await ctx.db.patch(args.id, {
      column: args.column,
      order: args.order,
      ...(args.status && { status: args.status }),
    });

    // Reorder other items in the target column
    let columnIdeas;
    if (idea.organizationId) {
      columnIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", idea.organizationId).eq("column", args.column),
        )
        .collect();
    } else {
      columnIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) =>
          q.eq("userId", identity.subject).eq("column", args.column),
        )
        .collect();
    }

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

    // Schedule Notion sync in background
    if (wasInConcept && movingToToStream) {
      await ctx.scheduler.runAfter(0, internal.notion.syncToNotion, { ideaId: args.id });
    }

    if (wasInToStream && movingToConcept && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, { ideaId: args.id });
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
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    column: v.optional(v.union(v.literal("Concept"), v.literal("To Stream"))),
    owner: v.optional(
      v.union(
        v.literal("Theo"),
        v.literal("Phase"),
        v.literal("Mir"),
        v.literal("flip"),
        v.literal("melkey"),
        v.literal("gabriel"),
        v.literal("ben"),
        v.literal("shivam"),
      ),
    ),
    channel: v.optional(
      v.union(
        v.literal("C:Main"),
        v.literal("C:Rants"),
        v.literal("C:Throwaways"),
        v.literal("C:Other"),
        v.literal("C:Main(SHORT)"),
      ),
    ),
    potential: v.optional(v.number()),
    label: v.optional(
      v.union(
        v.literal("Requires Planning"),
        v.literal("Priority"),
        v.literal("Mid Priority"),
        v.literal("Strict deadline"),
        v.literal("Sponsored"),
        v.literal("High Effort"),
        v.literal("Worth it?"),
        v.literal("Evergreen"),
        v.literal("Database Week"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("To Record(Off stream)"),
        v.literal("To Stream"),
        v.literal("Recorded"),
        v.literal("Editing"),
        v.literal("Done Editing"),
        v.literal("NEEDS THUMBNAIL"),
        v.literal("Ready To Publish"),
        v.literal("Scheduled"),
        v.literal("Published"),
        v.literal("Concept"),
        v.literal("Commited"),
        v.literal("dead"),
        v.literal("Shorts"),
        v.literal("2nd & 3rd Channel"),
        v.literal("Needs sponsor spot"),
        v.literal("Theo's Problem"),
      ),
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
    ),
    unsponsored: v.optional(v.boolean()),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea) {
      throw new Error("Idea not found");
    }

    // Check access: org idea requires matching orgId, personal requires user ownership
    if (idea.organizationId) {
      if (args.organizationId !== idea.organizationId) {
        throw new Error("Idea not found");
      }
    } else if (idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    const { id, clearThumbnail, organizationId: _organizationId, ...updates } = args;
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

    // Handle column change sync logic
    const wasInConcept = idea.column === "Concept";
    const wasInToStream = idea.column === "To Stream";
    const movingToToStream = args.column === "To Stream";
    const movingToConcept = args.column === "Concept";

    // If moving from Concept to To Stream, create Notion page
    if (wasInConcept && movingToToStream && !idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.syncToNotion, { ideaId: args.id });
      return;
    }

    // If moving from To Stream to Concept, delete from Notion
    if (wasInToStream && movingToConcept && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, { ideaId: args.id });
      return;
    }

    // If already in To Stream and has notionPageId, sync updates
    const shouldSyncToNotion = idea.column === "To Stream" && !!idea.notionPageId;
    if (shouldSyncToNotion) {
      const contentFields = ["description", "notes", "thumbnail", "resources"] as const;
      const contentChanged = contentFields.some(
        (field) => args[field] !== undefined && args[field] !== idea[field],
      );

      await ctx.scheduler.runAfter(0, internal.notion.updateInNotion, {
        ideaId: args.id,
        syncContent: contentChanged,
      });
    }
  },
});

export const remove = mutation({
  args: {
    id: v.id("ideas"),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const idea = await ctx.db.get(args.id);
    if (!idea) {
      throw new Error("Idea not found");
    }

    // Check access: org idea requires matching orgId, personal requires user ownership
    if (idea.organizationId) {
      if (args.organizationId !== idea.organizationId) {
        throw new Error("Idea not found");
      }
    } else if (idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    if (isStorageId(idea.thumbnail)) {
      await ctx.storage.delete(idea.thumbnail as Id<"_storage">);
    }

    const shouldDeleteFromNotion = idea.column === "To Stream" && !!idea.notionPageId;
    const notionPageId = idea.notionPageId ?? null;
    const userId = idea.userId;

    await ctx.db.delete(args.id);

    // Schedule Notion deletion in background if needed
    if (shouldDeleteFromNotion && notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.deleteFromNotion, {
        ideaId: args.id,
        userId,
        notionPageId,
      });
    }
  },
});
