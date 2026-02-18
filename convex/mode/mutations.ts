import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const setTheoMode = mutation({
  args: {
    enabled: v.boolean(),
  },
  handler: async (_ctx, _args) => {
    throw new Error("Theo mode can only be changed in Convex dashboard via modeSettings");
  },
});
