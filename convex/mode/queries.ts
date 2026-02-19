import { v } from "convex/values";
import { internalQuery, query } from "../_generated/server";
import { coreStatusValues } from "../../shared/app-mode";
import {
  canManageTheoModeForIdentity,
  getModeForScope,
  resolveModeScopeFromIdentity,
} from "../utils/mode";

const buildCapabilities = (mode: "default" | "theo", canManageTheoMode: boolean) => ({
  notion: mode === "theo",
  theoMetadata: mode === "theo",
  statuses: mode === "theo" ? "theo" : "core",
  allowedCoreStatuses: coreStatusValues,
  canManageTheoMode,
});

export const getCurrentMode = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return {
        mode: "default" as const,
        capabilities: buildCapabilities("default", false),
      };
    }

    const scope = resolveModeScopeFromIdentity(identity);
    const [mode, canManageTheoMode] = await Promise.all([
      getModeForScope(ctx, scope),
      canManageTheoModeForIdentity(ctx, identity),
    ]);

    return {
      mode,
      capabilities: buildCapabilities(mode, canManageTheoMode),
    };
  },
});

export const getModeForScopeInternal = internalQuery({
  args: {
    organizationId: v.optional(v.string()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.organizationId) {
      return await getModeForScope(ctx, {
        kind: "organization",
        id: args.organizationId,
      });
    }

    if (args.userId) {
      return "default" as const;
    }

    return "default" as const;
  },
});
