import { internalMutation, mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { assertOrgAccess } from "../utils/auth";
import {
  adReadTrackerValues,
  channelValues,
  labelValues,
  ownerValues,
  statusValues,
} from "../utils/types";

const payloadSchema = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  notes: v.optional(v.string()),
  thumbnail: v.optional(v.union(v.string(), v.null())),
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
      v.literal("archived"),
    ),
  ),
  adReadTracker: v.optional(
    v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done")),
  ),
  unsponsored: v.optional(v.boolean()),
  column: v.union(v.literal("Concept"), v.literal("To Stream")),
  order: v.number(),
});

const literalUnion = <T extends readonly string[]>(values: T) =>
  v.union(...values.map((value) => v.literal(value)));

const isStorageId = (value: string | null | undefined): value is string =>
  !!value && value.startsWith("k") && !value.includes("://");

export const createExportInternal = internalMutation({
  args: {
    tokenHash: v.string(),
    token: v.string(),
    shareUrl: v.optional(v.string()),
    sourceOrganizationId: v.string(),
    createdBy: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
    items: v.array(
      v.object({
        ideaId: v.id("ideas"),
        payload: payloadSchema,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const exportId = await ctx.db.insert("ideaExports", {
      tokenHash: args.tokenHash,
      token: args.token,
      shareUrl: args.shareUrl,
      sourceOrganizationId: args.sourceOrganizationId,
      createdBy: args.createdBy,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
      maxUses: 1,
      uses: 0,
      itemCount: args.items.length,
    });

    for (const item of args.items) {
      await ctx.db.insert("ideaExportItems", {
        exportId,
        ideaId: item.ideaId,
        payload: item.payload,
      });
    }

    return {
      exportId,
      itemCount: args.items.length,
    };
  },
});

export const consumeExportInternal = internalMutation({
  args: {
    exportId: v.id("ideaExports"),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.exportId);
    if (!record) {
      throw new Error("Share link not found");
    }
    if (record.revokedAt) {
      throw new Error("Share link revoked");
    }
    if (record.expiresAt <= Date.now()) {
      throw new Error("Share link expired");
    }
    if (record.uses >= record.maxUses) {
      throw new Error("Share link already used");
    }

    await ctx.db.patch(args.exportId, {
      uses: record.uses + 1,
    });
  },
});

export const revokeExport = mutation({
  args: {
    exportId: v.id("ideaExports"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const record = await ctx.db.get(args.exportId);
    if (!record) {
      throw new Error("Share link not found");
    }

    assertOrgAccess(identity, record.sourceOrganizationId);
    if (record.createdBy !== identity.subject) {
      throw new Error("Unauthorized");
    }

    if (record.revokedAt) {
      return;
    }

    await ctx.db.patch(args.exportId, {
      revokedAt: Date.now(),
    });
  },
});

export const insertImportedIdeasInternal = internalMutation({
  args: {
    targetOrganizationId: v.string(),
    userId: v.string(),
    exportId: v.id("ideaExports"),
    sourceOrganizationId: v.string(),
    items: v.array(
      v.object({
        sourceIdeaId: v.id("ideas"),
        payload: payloadSchema,
      }),
    ),
  },
  handler: async (ctx, args) => {
    const notionConnection = await ctx.db
      .query("notionConnections")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.targetOrganizationId))
      .first();

    const columns = ["Concept", "To Stream"] as const;
    const nextOrderByColumn = new Map<(typeof columns)[number], number>();
    for (const column of columns) {
      const existingIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", args.targetOrganizationId).eq("column", column),
        )
        .collect();
      const maxOrder = existingIdeas.reduce((max, idea) => Math.max(max, idea.order), -1);
      nextOrderByColumn.set(column, maxOrder + 1);
    }

    const sortedItems = [...args.items].sort((a, b) => {
      if (a.payload.column !== b.payload.column) {
        return a.payload.column === "Concept" ? -1 : 1;
      }
      return a.payload.order - b.payload.order;
    });

    const importedIdeaIds: Id<"ideas">[] = [];
    for (const item of sortedItems) {
      const nextOrder = nextOrderByColumn.get(item.payload.column) ?? 0;
      nextOrderByColumn.set(item.payload.column, nextOrder + 1);

      const ideaId = await ctx.db.insert("ideas", {
        userId: args.userId,
        organizationId: args.targetOrganizationId,
        title: item.payload.title,
        description: item.payload.description,
        notes: item.payload.notes,
        thumbnail: item.payload.thumbnail ?? null,
        thumbnailReady: item.payload.thumbnailReady,
        resources: item.payload.resources,
        vodRecordingDate: item.payload.vodRecordingDate,
        releaseDate: item.payload.releaseDate,
        owner: item.payload.owner,
        channel: item.payload.channel,
        potential: item.payload.potential,
        label: item.payload.label,
        status: item.payload.status,
        adReadTracker: item.payload.adReadTracker,
        unsponsored: item.payload.unsponsored,
        column: item.payload.column,
        order: nextOrder,
        notionPageId: undefined,
        syncedAt: undefined,
        importedFromExportId: args.exportId,
        importedFromOrganizationId: args.sourceOrganizationId,
        importedFromIdeaId: item.sourceIdeaId,
        importedAt: Date.now(),
      });

      importedIdeaIds.push(ideaId);

      if (notionConnection?.databaseId && item.payload.column === "To Stream") {
        await ctx.scheduler.runAfter(0, internal.notion.actions.syncToNotion, { ideaId });
      }
    }

    return importedIdeaIds;
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
    owner: v.optional(literalUnion(ownerValues)),
    channel: v.optional(literalUnion(channelValues)),
    potential: v.optional(v.number()),
    label: v.optional(literalUnion(labelValues)),
    status: v.optional(literalUnion(statusValues)),
    adReadTracker: v.optional(literalUnion(adReadTrackerValues)),
    unsponsored: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Get existing ideas for order calculation based on org or personal
    let existingIdeas;
    const orgId = identity.org_id;
    if (orgId) {
      existingIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", orgId).eq("column", "Concept"),
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
      organizationId: orgId ?? undefined,
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
      assertOrgAccess(identity, idea.organizationId);
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
      await ctx.scheduler.runAfter(0, internal.notion.actions.syncToNotion, { ideaId: args.id });
    }

    if (wasInToStream && movingToConcept && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.actions.deleteFromNotion, {
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
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
    column: v.optional(v.union(v.literal("Concept"), v.literal("To Stream"))),
    owner: v.optional(literalUnion(ownerValues)),
    channel: v.optional(literalUnion(channelValues)),
    potential: v.optional(v.number()),
    label: v.optional(literalUnion(labelValues)),
    status: v.optional(literalUnion(statusValues)),
    adReadTracker: v.optional(literalUnion(adReadTrackerValues)),
    unsponsored: v.optional(v.boolean()),
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
      assertOrgAccess(identity, idea.organizationId);
    } else if (idea.userId !== identity.subject) {
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

    // Handle column change sync logic
    const wasInConcept = idea.column === "Concept";
    const wasInToStream = idea.column === "To Stream";
    const movingToToStream = args.column === "To Stream";
    const movingToConcept = args.column === "Concept";

    // If moving from Concept to To Stream, create Notion page
    if (wasInConcept && movingToToStream && !idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.actions.syncToNotion, { ideaId: args.id });
      return;
    }

    // If moving from To Stream to Concept, delete from Notion
    if (wasInToStream && movingToConcept && idea.notionPageId) {
      await ctx.scheduler.runAfter(0, internal.notion.actions.deleteFromNotion, {
        ideaId: args.id,
      });
      return;
    }

    // If already in To Stream and has notionPageId, sync updates
    const shouldSyncToNotion = idea.column === "To Stream" && !!idea.notionPageId;
    if (shouldSyncToNotion) {
      const contentFields = ["description", "notes", "thumbnail", "resources"] as const;
      const contentChanged = contentFields.some(
        (field) => args[field] !== undefined && args[field] !== idea[field],
      );

      await ctx.scheduler.runAfter(0, internal.notion.actions.updateInNotion, {
        ideaId: args.id,
        syncContent: contentChanged,
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
    if (!idea) {
      throw new Error("Idea not found");
    }

    // Check access: org idea requires matching orgId, personal requires user ownership
    if (idea.organizationId) {
      assertOrgAccess(identity, idea.organizationId);
    } else if (idea.userId !== identity.subject) {
      throw new Error("Idea not found");
    }

    if (isStorageId(idea.thumbnail)) {
      await ctx.storage.delete(idea.thumbnail as Id<"_storage">);
    }

    const shouldDeleteFromNotion = idea.column === "To Stream" && !!idea.notionPageId;
    const notionPageId = idea.notionPageId ?? null;
    const organizationId = idea.organizationId;

    await ctx.db.delete(args.id);

    // Schedule Notion deletion in background if needed
    if (shouldDeleteFromNotion && notionPageId && organizationId) {
      await ctx.scheduler.runAfter(0, internal.notion.actions.deleteFromNotion, {
        ideaId: args.id,
        organizationId,
        notionPageId,
      });
    }
  },
});
