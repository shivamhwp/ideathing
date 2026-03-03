import { mutation } from "../_generated/server";
import { requireAuth } from "../helper";

const hasKeys = (value: Record<string, unknown>) => Object.keys(value).length > 0;

export const ensureUserModeState = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const now = Date.now();
    const actorUserId = identity.subject;

    const userFlags = await ctx.db
      .query("userFlags")
      .withIndex("by_user", (q) => q.eq("userId", actorUserId))
      .first();

    if (!userFlags) {
      await ctx.db.insert("userFlags", {
        userId: actorUserId,
        canManageTheoMode: false,
        updatedAt: now,
        updatedBy: actorUserId,
      });
    } else {
      const userFlagsPatch = {
        ...(userFlags.canManageTheoMode === undefined ? { canManageTheoMode: false } : {}),
        ...(userFlags.updatedAt === undefined ? { updatedAt: now } : {}),
        ...(userFlags.updatedBy === undefined ? { updatedBy: actorUserId } : {}),
      };

      if (hasKeys(userFlagsPatch)) {
        await ctx.db.patch(userFlags._id, userFlagsPatch);
      }
    }

    const organizationId = identity.org_id;
    if (!organizationId) {
      return { organizationId: null };
    }

    const modeSetting = await ctx.db
      .query("modeSettings")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .first();

    if (!modeSetting) {
      await ctx.db.insert("modeSettings", {
        organizationId,
        theoMode: false,
        updatedAt: now,
        updatedBy: actorUserId,
      });
      return { organizationId };
    }

    const modeSettingPatch = {
      ...(modeSetting.theoMode === undefined ? { theoMode: false } : {}),
      ...(modeSetting.updatedAt === undefined ? { updatedAt: now } : {}),
      ...(modeSetting.updatedBy === undefined ? { updatedBy: actorUserId } : {}),
    };

    if (hasKeys(modeSettingPatch)) {
      await ctx.db.patch(modeSetting._id, modeSettingPatch);
    }

    return { organizationId };
  },
});
