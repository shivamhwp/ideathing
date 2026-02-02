import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand: "bun run build",
  installCommand: "bun install",
};
