import { internalQuery, query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";



export const getIdeasForExportInternal = internalQuery({
  args: {
    ideaIds: v.array(v.id("ideas")),
  },
  handler: async (ctx, args) => {
    const ideas: Doc<"ideas">[] = [];
    for (const ideaId of args.ideaIds) {
      const idea = await ctx.db.get(ideaId);
      if (idea) {
        ideas.push(idea);
      }
    }
    return ideas;
  },
});




export const getExportByTokenInternal = internalQuery({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ideaExports")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();
  },
});

export const listExportItemsInternal = internalQuery({
  args: {
    exportId: v.id("ideaExports"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ideaExportItems")
      .withIndex("by_export", (q) => q.eq("exportId", args.exportId))
      .collect();
  },
});



export const list = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return [];
    }

    try {
      const orgId = identity.org_id;
      if (orgId) {
        const ideas = await ctx.db
          .query("ideas")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
          .collect();
        return ideas;
      }

      const ideas = await ctx.db
        .query("ideas")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .filter((q) => q.eq(q.field("organizationId"), undefined))
        .collect();

      return ideas;
    } catch (error) {
      console.error("ideas.list failed", {
        error,
        subject: identity.subject,
        organizationId: identity.org_id
      });
      return [];
    }
  },
});

export const get = query({
  args: {
    id: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return null;
    }
    try {
      const idea = await ctx.db.get(args.id);
      if (!idea) {
        return null;
      }

      // If idea belongs to an organization, check org access
      if (idea.organizationId) {
        const orgId = identity.org_id;
        if (!orgId) {
          return null;
        }
        if (orgId !== idea.organizationId) return null;
        return idea;
      }

      // Personal idea - check user ownership
      if (idea.userId !== identity.subject) {
        return null;
      }

      return idea;
    } catch (error) {
      console.error("ideas.get failed", {
        error,
        subject: identity.subject,
        organizationId: identity.org_id,
        ideaId: args.id,
      });
      return null;
    }
  },
});

export const listRecorded = query({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return [];
    }

    try {
      const orgId = identity.org_id;
      if (orgId) {
        const ideas = await ctx.db
          .query("ideas")
          .withIndex("by_organization", (q) => q.eq("organizationId", orgId))
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
    } catch (error) {
      console.error("ideas.listRecorded failed", {
        error,
        subject: identity.subject,
        organizationId: identity.org_id,
      });
      return [];
    }
  },
});

export const listByColumn = query({
  args: {
    column: v.union(v.literal("Concept"), v.literal("To Stream")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) {
      return [];
    }

    try {
      const orgId = identity.org_id;
      if (orgId) {
        const ideas = await ctx.db
          .query("ideas")
          .withIndex("by_organization_column", (q) =>
            q.eq("organizationId", orgId).eq("column", args.column),
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
    } catch (error) {
      console.error("ideas.listByColumn failed", {
        error,
        subject: identity.subject,
        organizationId: identity.org_id,
        column: args.column,
      });
      return [];
    }
  },
});
