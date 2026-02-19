import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { UserIdentity } from "convex/server";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { requireAuth } from "../helper";
import { isTheoModeForIdentity } from "../utils/mode";

type IdeaDoc = Doc<"ideas">;
type IdeaColumn = IdeaDoc["column"];
type IdeaStatus = IdeaDoc["status"];

type ListOptions = {
  status?: IdeaStatus;
  column?: IdeaColumn;
  sortByOrder?: boolean;
};

const applyListOptions = (ideas: IdeaDoc[], options: ListOptions): IdeaDoc[] => {
  const { status, sortByOrder } = options;
  let nextIdeas = ideas;
  if (status) {
    nextIdeas = nextIdeas.filter((idea) => idea.status === status);
  }
  if (sortByOrder) {
    nextIdeas = [...nextIdeas].sort((a, b) => a.order - b.order);
  }
  return nextIdeas;
};

const listIdeasForOrg = async (
  ctx: QueryCtx,
  organizationId: string,
  options: ListOptions,
): Promise<IdeaDoc[]> => {
  const { column } = options;
  const ideas = column
    ? await ctx.db
        .query("ideas")
        .withIndex("by_organization_column", (q) =>
          q.eq("organizationId", organizationId).eq("column", column),
        )
        .collect()
    : await ctx.db
        .query("ideas")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect();

  return applyListOptions(ideas, options);
};

const listIdeasForUser = async (
  ctx: QueryCtx,
  userId: string,
  options: ListOptions,
): Promise<IdeaDoc[]> => {
  const { column } = options;
  const ideas = column
    ? await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) => q.eq("userId", userId).eq("column", column))
        .filter((q) => q.eq(q.field("organizationId"), undefined))
        .collect()
    : await ctx.db
        .query("ideas")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("organizationId"), undefined))
        .collect();

  return applyListOptions(ideas, options);
};

const listIdeasForIdentity = async (
  ctx: QueryCtx,
  identity: UserIdentity,
  options: ListOptions = {},
) => {
  const orgId = identity.org_id;
  if (orgId) {
    return listIdeasForOrg(ctx, orgId, options);
  }
  return listIdeasForUser(ctx, identity.subject, options);
};

export const getIdeasForExportInternal = internalQuery({
  args: {
    ideaIds: v.array(v.id("ideas")),
  },
  handler: async (ctx, args) => {
    const ideas: IdeaDoc[] = [];
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
    try {
      const identity = await requireAuth(ctx).catch(() => null);
      if (!identity) {
        return [];
      }
      const ideas = await listIdeasForIdentity(ctx, identity);
      return ideas;
    } catch (error) {
      console.error("ideas.list failed", {
        error,
      });
      return [];
    }
  },
});

export const listExportsForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx).catch(() => null);
    if (!identity) {
      return [];
    }
    const orgId = identity.org_id;
    if (!orgId) {
      return [];
    }
    const exports = await ctx.db
      .query("ideaExports")
      .withIndex("by_source_org", (q) => q.eq("sourceOrganizationId", orgId))
      .collect();

    return exports
      .filter((record) => record.createdBy === identity.subject && !record.revokedAt)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((record) => ({
        _id: record._id,
        shareUrl: record.shareUrl,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        uses: record.uses,
        maxUses: record.maxUses,
      }));
  },
});

export const listRecorded = query({
  args: {},
  handler: async (ctx, _args) => {
    try {
      const identity = await requireAuth(ctx).catch(() => null);
      if (!identity) {
        return [];
      }
      const ideas = await listIdeasForIdentity(ctx, identity, { status: "Recorded" });
      return ideas;
    } catch (error) {
      console.error("ideas.listRecorded failed", {
        error,
      });
      return [];
    }
  },
});

export const listTheoQueue = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx).catch(() => null);
    if (!identity) {
      return [];
    }

    const theoModeEnabled = await isTheoModeForIdentity(ctx, identity);
    if (!theoModeEnabled) {
      return [];
    }

    const ideas = await listIdeasForIdentity(ctx, identity, {
      sortByOrder: true,
    });

    return ideas.filter((idea) => !idea.inNotion).sort((a, b) => a.order - b.order);
  },
});
