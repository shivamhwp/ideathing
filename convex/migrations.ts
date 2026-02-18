import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});

export const backfillIdeaSendFields = migrations.define({
  table: "ideas",
  migrateOne: (_ctx, idea) => {
    const inNotion = idea.inNotion ?? Boolean(idea.notionPageId);
    const notionSendState = inNotion ? ("sent" as const) : ("idle" as const);

    return {
      inNotion,
      notionSentAt: inNotion ? (idea.notionSentAt ?? Date.now()) : undefined,
      notionSendBy: inNotion ? (idea.notionSendBy ?? idea.userId) : undefined,
      notionSendState,
      notionSendError: undefined,
      notionSynced: undefined,
      notionSyncInFlight: undefined,
      notionSyncInFlightAt: undefined,
      syncedAt: undefined,
    };
  },
});

export const clearConnectionSyncBackfillFields = migrations.define({
  table: "notionConnections",
  migrateOne: () => ({
    syncBackfillRunning: undefined,
    syncBackfillRequestedAt: undefined,
    syncBackfillCompletedAt: undefined,
    syncBackfillLastError: undefined,
  }),
});

export const purgeNotionPageTombstones = migrations.define({
  table: "notionPageTombstones",
  migrateOne: async (ctx, tombstone) => {
    await ctx.db.delete(tombstone._id);
  },
});

export const run = migrations.runner();

export const runNotionOneWayCleanup = migrations.runner([
  internal.migrations.backfillIdeaSendFields,
  internal.migrations.clearConnectionSyncBackfillFields,
  internal.migrations.purgeNotionPageTombstones,
]);
