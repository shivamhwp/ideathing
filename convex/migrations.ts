import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

const migrations = new Migrations<DataModel>(components.migrations, {
  internalMutation,
});

export const backfillIdeaSendFields = migrations.define({
  table: "ideas",
  migrateOne: (_ctx, idea) => {
    const inNotion = idea.inNotion ?? idea.notionSynced ?? Boolean(idea.notionPageId);
    const notionSendState = inNotion ? ("sent" as const) : ("idle" as const);

    return {
      inNotion,
      notionSynced: undefined,
      notionSentAt: inNotion ? (idea.notionSentAt ?? Date.now()) : undefined,
      notionSendBy: inNotion ? (idea.notionSendBy ?? idea.userId) : undefined,
      notionSendState,
      notionSendError: undefined,
    };
  },
});

export const cleanupLegacyNotionSynced = migrations.define({
  table: "ideas",
  migrateOne: (_ctx, idea) => {
    if (idea.notionSynced === undefined) {
      return;
    }

    const inNotion = idea.inNotion ?? idea.notionSynced ?? Boolean(idea.notionPageId);
    return {
      inNotion,
      notionSynced: undefined,
      notionSentAt: inNotion ? (idea.notionSentAt ?? Date.now()) : undefined,
      notionSendBy: inNotion ? (idea.notionSendBy ?? idea.userId) : undefined,
      notionSendState: idea.notionSendState ?? (inNotion ? "sent" : "idle"),
    };
  },
});

export const run = migrations.runner();
