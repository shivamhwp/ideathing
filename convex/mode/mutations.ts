import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAuth } from "../helper";
import { canManageTheoModeForIdentity, getModeForScope } from "../utils/mode";

export const setTheoMode = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("Theo mode can only be changed in organization context");
    }

    const canManageTheoMode = await canManageTheoModeForIdentity(ctx, identity);
    if (!canManageTheoMode) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    const existing = await ctx.db
      .query("modeSettings")
      .withIndex("by_organization_scope", (q) =>
        q.eq("organizationId", orgId).eq("scope", "organization"),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        theoMode: args.enabled,
        updatedAt: now,
        updatedBy: identity.subject,
      });
    } else {
      await ctx.db.insert("modeSettings", {
        scope: "organization",
        organizationId: orgId,
        theoMode: args.enabled,
        updatedAt: now,
        updatedBy: identity.subject,
      });
    }

    const mode = await getModeForScope(ctx, { kind: "organization", id: orgId });

    return {
      mode,
    };
  },
});
