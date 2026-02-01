import { v } from "convex/values";
import { mutation, internalMutation } from "../_generated/server";

const ownerValues = ["Theo", "Phase", "Mir", "flip", "melkey", "gabriel", "ben", "shivam"] as const;

const channelValues = ["C:Main", "C:Rants", "C:Throwaways", "C:Other", "C:Main(SHORT)"] as const;

const labelValues = [
  "Requires Planning",
  "Priority",
  "Mid Priority",
  "Strict deadline",
  "Sponsored",
  "High Effort",
  "Worth it?",
  "Evergreen",
  "Database Week",
] as const;

const statusValues = [
  "To Record(Off stream)",
  "To Stream",
  "Recorded",
  "Editing",
  "Done Editing",
  "NEEDS THUMBNAIL",
  "Ready To Publish",
  "Scheduled",
  "Published",
  "Concept",
  "Commited",
  "dead",
  "Shorts",
  "2nd & 3rd Channel",
  "Needs sponsor spot",
  "Theo's Problem",
  "archived",
] as const;

const adReadTrackerValues = ["planned", "in da edit", "done"] as const;

type Owner = (typeof ownerValues)[number];
type Channel = (typeof channelValues)[number];
type Label = (typeof labelValues)[number];
type Status = (typeof statusValues)[number];
type AdReadTracker = (typeof adReadTrackerValues)[number];

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

// Legacy validators (kept for compatibility)
const isValidOwner = (value?: string): value is Owner => !!normalizeOwner(value);
const isValidChannel = (value?: string): value is Channel => !!normalizeChannel(value);
const isValidLabel = (value?: string): value is Label => !!normalizeLabel(value);
const isValidStatus = (value?: string): value is Status => !!normalizeStatus(value);
const isValidAdReadTracker = (value?: string): value is AdReadTracker =>
  !!normalizeAdReadTracker(value);

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
      console.log("createIdeaFromWebhook: Idea already exists for page", args.notionPageId);
      return existingIdea._id;
    }

    const columnIdeas = await ctx.db
      .query("ideas")
      .withIndex("by_user_column", (q) => q.eq("userId", args.userId).eq("column", args.column))
      .collect();
    const maxOrder = columnIdeas.reduce((max, idea) => Math.max(max, idea.order), -1);

    const ideaId = await ctx.db.insert("ideas", {
      userId: args.userId,
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

    console.log("createIdeaFromWebhook: Created idea", ideaId);
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
