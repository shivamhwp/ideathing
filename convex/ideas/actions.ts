"use node";
import { v } from "convex/values";
import { createHash, randomBytes } from "node:crypto";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { requireAuth } from "../helper";
import { assertOrgAdmin, getIdentityOrgId } from "../utils/auth";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const internalApiPromise = import("../_generated/api") as Promise<any>;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const isStorageId = (value: string | null | undefined): value is string =>
  !!value && value.startsWith("k") && !value.includes("://");

type ExportPayload = {
  title: string;
  description?: string;
  notes?: string;
  thumbnail?: string | null;
  thumbnailReady?: boolean;
  resources?: string[];
  vodRecordingDate?: string;
  releaseDate?: string;
  owner?: "Theo" | "Phase" | "Mir" | "flip" | "melkey" | "gabriel" | "ben" | "shivam";
  channel?: "C:Main" | "C:Rants" | "C:Throwaways" | "C:Other" | "C:Main(SHORT)";
  potential?: number;
  label?: (
    | "Requires Planning"
    | "Priority"
    | "Mid Priority"
    | "Strict deadline"
    | "Sponsored"
    | "High Effort"
    | "Worth it?"
    | "Evergreen"
    | "Database Week"
  )[];
  status?:
    | "To Record(Off stream)"
    | "To Stream"
    | "Recorded"
    | "Editing"
    | "Done Editing"
    | "NEEDS THUMBNAIL"
    | "Ready To Publish"
    | "Scheduled"
    | "Published"
    | "Concept"
    | "Commited"
    | "dead"
    | "Shorts"
    | "2nd & 3rd Channel"
    | "Needs sponsor spot"
    | "Theo's Problem"
    | "archived";
  adReadTracker?: string;
  unsponsored?: boolean;
  column: "Concept" | "To Stream";
  order: number;
};

export const getSummary = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx).catch(() => null);
    if (!identity) {
      return null;
    }

    const tokenHash = hashToken(args.token);
    const { internal: internalApi } = await internalApiPromise;
    const runQuery = ctx.runQuery as any;
    const exportRecord = (await runQuery(internalApi.ideas.queries.getExportByTokenInternal, {
      tokenHash,
    })) as Doc<"ideaExports"> | null;

    if (!exportRecord) {
      return null;
    }

    if (exportRecord.revokedAt) {
      return null;
    }

    if (exportRecord.expiresAt <= Date.now()) {
      return null;
    }

    if (exportRecord.uses >= exportRecord.maxUses) {
      return null;
    }

    return {
      itemCount: exportRecord.itemCount,
      createdAt: exportRecord.createdAt,
      expiresAt: exportRecord.expiresAt,
      sourceOrganizationId: exportRecord.sourceOrganizationId,
    };
  },
});

export const create = action({
  args: {
    ideaIds: v.array(v.id("ideas")),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const { internal: internalApi } = await internalApiPromise;
    const runQuery = ctx.runQuery as any;
    const runMutation = ctx.runMutation as any;

    const orgId = getIdentityOrgId(identity);
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can share ideas");

    const uniqueIdeaIds = Array.from(new Set(args.ideaIds.map((id) => id.toString()))).map(
      (id) => id as Id<"ideas">,
    );

    if (uniqueIdeaIds.length === 0) {
      throw new Error("Select at least one idea to share");
    }

    const ideas = (await runQuery(internalApi.ideas.queries.getIdeasForExportInternal, {
      ideaIds: uniqueIdeaIds,
    })) as Doc<"ideas">[];

    if (ideas.length !== uniqueIdeaIds.length) {
      throw new Error("One or more ideas could not be shared");
    }

    for (const idea of ideas) {
      if (idea.organizationId !== orgId) {
        throw new Error("One or more ideas could not be shared");
      }
    }

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const shareUrl = `${args.origin}/share/${token}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + ONE_DAY_MS;

    const items = ideas.map((idea) => ({
      ideaId: idea._id,
      payload: {
        title: idea.title,
        description: idea.description,
        notes: idea.notes,
        thumbnail: (idea.thumbnail ?? null) as ExportPayload["thumbnail"],
        thumbnailReady: idea.thumbnailReady,
        resources: idea.resources,
        vodRecordingDate: idea.vodRecordingDate,
        releaseDate: idea.releaseDate,
        owner: idea.owner as ExportPayload["owner"],
        channel: idea.channel as ExportPayload["channel"],
        potential: idea.potential,
        label: idea.label as ExportPayload["label"],
        status: idea.status as ExportPayload["status"],
        adReadTracker: idea.adReadTracker as ExportPayload["adReadTracker"],
        unsponsored: idea.unsponsored,
        column: idea.column,
        order: idea.order,
      },
    }));

    await runMutation(internalApi.ideas.mutations.createExportInternal, {
      tokenHash,
      token,
      shareUrl,
      sourceOrganizationId: orgId,
      createdBy: identity.subject,
      createdAt,
      expiresAt,
      items,
    });

    return {
      shareUrl,
      expiresAt,
      itemCount: ideas.length,
    };
  },
});

export const importIdeas = action({
  args: {
    token: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    itemCount: number;
    importedIdeaIds: Id<"ideas">[];
  }> => {
    const identity = await requireAuth(ctx);

    const { internal: internalApi } = await internalApiPromise;
    const runQuery = ctx.runQuery as any;
    const runMutation = ctx.runMutation as any;

    assertOrgAdmin(identity, "Only organization admins can import ideas");
    const targetOrganizationId = getIdentityOrgId(identity);
    if (!targetOrganizationId) {
      throw new Error("No organization context");
    }

    const tokenHash = hashToken(args.token);
    const exportRecord = (await runQuery(internalApi.ideas.queries.getExportByTokenInternal, {
      tokenHash,
    })) as Doc<"ideaExports"> | null;

    if (!exportRecord) {
      throw new Error("Share link not found");
    }
    if (exportRecord.revokedAt) {
      throw new Error("Share link revoked");
    }
    if (exportRecord.expiresAt <= Date.now()) {
      throw new Error("Share link expired");
    }
    if (exportRecord.uses >= exportRecord.maxUses) {
      throw new Error("Share link already used");
    }

    await runMutation(internalApi.ideas.mutations.consumeExportInternal, {
      exportId: exportRecord._id,
    });

    const items = (await runQuery(internalApi.ideas.queries.listExportItemsInternal, {
      exportId: exportRecord._id,
    })) as Doc<"ideaExportItems">[];

    const mappedItems: { sourceIdeaId: Id<"ideas">; payload: ExportPayload }[] = [];
    for (const item of items) {
      let nextThumbnail = item.payload.thumbnail ?? null;
      if (isStorageId(nextThumbnail)) {
        try {
          const storageUrl = await ctx.storage.getUrl(nextThumbnail as Id<"_storage">);
          if (storageUrl) {
            const response = await fetch(storageUrl);
            if (response.ok) {
              const buffer = await response.arrayBuffer();
              const storageId = await ctx.storage.store(new Blob([buffer]));
              nextThumbnail = storageId;
            } else {
              nextThumbnail = null;
            }
          } else {
            nextThumbnail = null;
          }
        } catch (error) {
          void error;
          nextThumbnail = null;
        }
      }

      mappedItems.push({
        sourceIdeaId: item.ideaId,
        payload: {
          ...item.payload,
          label: item.payload.label as ExportPayload["label"],
          thumbnail: nextThumbnail,
        },
      });
    }

    const importedIdeaIds = await runMutation(
      internalApi.ideas.mutations.insertImportedIdeasInternal,
      {
        targetOrganizationId,
        userId: identity.subject,
        exportId: exportRecord._id,
        sourceOrganizationId: exportRecord.sourceOrganizationId,
        items: mappedItems,
      },
    );

    return {
      itemCount: importedIdeaIds.length,
      importedIdeaIds,
    };
  },
});
