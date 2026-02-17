"use node";
import { v } from "convex/values";
import { createHash, randomBytes } from "node:crypto";
import type { Doc, Id } from "../_generated/dataModel";
import { action } from "../_generated/server";
import { requireAuth } from "../helper";
import { assertOrgAdmin, getIdentityOrgId } from "../utils/auth";
import type { OwnerValue, ChannelValue, LabelValue, StatusValue } from "../../shared/idea-values";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const internalApiPromise = import("../_generated/api") as Promise<any>;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

type ExportPayload = {
  title: string;
  description?: string;
  notes?: string;
  draftThumbnail?: string | null;
  thumbnailReady?: boolean;
  resources?: string[];
  vodRecordingDate?: string;
  releaseDate?: string;
  owner?: OwnerValue;
  channel?: ChannelValue;
  potential?: number;
  label?: LabelValue[];
  status?: StatusValue;
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

    const exportItems = (await runQuery(internalApi.ideas.queries.listExportItemsInternal, {
      exportId: exportRecord._id,
    })) as Doc<"ideaExportItems">[];

    const previewIdeas = exportItems
      .map((item) => ({
        sourceIdeaId: item.ideaId,
        ...item.payload,
        resources: item.payload.resources ?? [],
        label: item.payload.label ?? [],
      }))
      .sort((a, b) => {
        if (a.column === b.column) {
          return a.order - b.order;
        }
        return a.column === "Concept" ? -1 : 1;
      });

    return {
      itemCount: exportRecord.itemCount,
      createdAt: exportRecord.createdAt,
      expiresAt: exportRecord.expiresAt,
      sourceOrganizationId: exportRecord.sourceOrganizationId,
      previewIdeas,
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
        draftThumbnail: idea.draftThumbnail as ExportPayload["draftThumbnail"],
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
      mappedItems.push({
        sourceIdeaId: item.ideaId,
        payload: {
          ...item.payload,
          owner: item.payload.owner as ExportPayload["owner"],
          channel: item.payload.channel as ExportPayload["channel"],
          label: item.payload.label as ExportPayload["label"],
          status: item.payload.status as ExportPayload["status"],
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
