import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { type AppMode, coreStatusValues } from "../../shared/app-mode";

type ModeScope =
  | {
      kind: "organization";
      id: string;
    }
  | {
      kind: "user";
      id: string;
    };

type ModeReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

type ModeSensitiveIdeaFields = Pick<
  Doc<"ideas">,
  | "owner"
  | "channel"
  | "label"
  | "potential"
  | "adReadTracker"
  | "unsponsored"
  | "vodRecordingDate"
  | "releaseDate"
  | "status"
>;

const coreStatusSet = new Set<string>(coreStatusValues);

const getModeSettingForScope = async (ctx: ModeReaderCtx, scope: ModeScope) => {
  if (scope.kind === "organization") {
    return await ctx.db
      .query("modeSettings")
      .withIndex("by_organization_scope", (q) =>
        q.eq("organizationId", scope.id).eq("scope", "organization"),
      )
      .first();
  }

  return null;
};

const getUserFlags = async (ctx: ModeReaderCtx, userId: string) => {
  return await ctx.db
    .query("userFlags")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
};

export const resolveModeScopeFromIdentity = (identity: UserIdentity): ModeScope => {
  const orgId = identity.org_id;
  if (orgId) {
    return {
      kind: "organization",
      id: orgId,
    };
  }

  return {
    kind: "user",
    id: identity.subject,
  };
};

export const resolveModeScopeFromIdea = (
  idea: Pick<Doc<"ideas">, "organizationId" | "userId">,
): ModeScope => {
  if (idea.organizationId) {
    return {
      kind: "organization",
      id: idea.organizationId,
    };
  }

  return {
    kind: "user",
    id: idea.userId,
  };
};

export const canManageTheoModeForUserId = async (ctx: ModeReaderCtx, userId: string) => {
  const flags = await getUserFlags(ctx, userId);
  return Boolean(flags?.canManageTheoMode);
};

export const canManageTheoModeForIdentity = async (ctx: ModeReaderCtx, identity: UserIdentity) => {
  if (!identity.org_id) {
    return false;
  }

  return await canManageTheoModeForUserId(ctx, identity.subject);
};

export const getModeForScope = async (ctx: ModeReaderCtx, scope: ModeScope): Promise<AppMode> => {
  if (scope.kind !== "organization") {
    return "default";
  }

  const setting = await getModeSettingForScope(ctx, scope);
  return setting?.theoMode ? "theo" : "default";
};

export const getModeForIdentity = async (
  ctx: ModeReaderCtx,
  identity: UserIdentity,
): Promise<AppMode> => {
  return await getModeForScope(ctx, resolveModeScopeFromIdentity(identity));
};

export const getModeForIdea = async (
  ctx: ModeReaderCtx,
  idea: Pick<Doc<"ideas">, "organizationId" | "userId">,
): Promise<AppMode> => {
  return await getModeForScope(ctx, resolveModeScopeFromIdea(idea));
};

export const isTheoModeForScope = async (ctx: ModeReaderCtx, scope: ModeScope) => {
  return (await getModeForScope(ctx, scope)) === "theo";
};

export const isTheoModeForIdentity = async (ctx: ModeReaderCtx, identity: UserIdentity) => {
  return (await getModeForIdentity(ctx, identity)) === "theo";
};

export const isTheoModeForIdea = async (
  ctx: ModeReaderCtx,
  idea: Pick<Doc<"ideas">, "organizationId" | "userId">,
) => {
  return (await getModeForIdea(ctx, idea)) === "theo";
};

export const sanitizeStatusForMode = (
  status: string | null | undefined,
  isTheoMode: boolean,
): Doc<"ideas">["status"] => {
  if (!status) {
    return undefined;
  }

  if (isTheoMode) {
    return status as Doc<"ideas">["status"];
  }

  if (coreStatusSet.has(status)) {
    return status as Doc<"ideas">["status"];
  }

  return undefined;
};

export const sanitizeModeSensitiveIdeaFields = (
  fields: ModeSensitiveIdeaFields,
  isTheoMode: boolean,
): ModeSensitiveIdeaFields => {
  if (isTheoMode) {
    return {
      ...fields,
      status: sanitizeStatusForMode(fields.status, true),
    };
  }

  return {
    owner: undefined,
    channel: undefined,
    label: undefined,
    potential: undefined,
    adReadTracker: undefined,
    unsponsored: undefined,
    vodRecordingDate: undefined,
    releaseDate: undefined,
    status: sanitizeStatusForMode(fields.status, false),
  };
};
