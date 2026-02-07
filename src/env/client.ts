import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    VITE_NOTION_CLIENT_ID: z.string().min(1),
    VITE_CONVEX_URL: z.url(),
    VITE_CONVEX_SITE_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
});
