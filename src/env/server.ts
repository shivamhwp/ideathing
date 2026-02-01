import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NOTION_CLIENT_ID: z.uuid(),
    NOTION_CLIENT_SECRET: z.string().min(1),
    NOTION_OAUTH_REDIRECT_URI: z.url(),
    NOTION_AUTHORIZATION_URL: z.url(),
  },
  runtimeEnv: process.env,
});
