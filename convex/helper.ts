import { ConvexError } from "convex/values";
import { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

export async function requireAuth(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized");
  }
  return identity;
}
