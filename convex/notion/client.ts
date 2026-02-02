import { Client } from "@notionhq/client";
import { NOTION_VERSION } from "./types";

export const createNotionClient = (auth: string) =>
  new Client({
    auth,
    notionVersion: NOTION_VERSION,
  });
