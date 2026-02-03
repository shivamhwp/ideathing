import { Client } from "@notionhq/client";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { NOTION_VERSION } from "../../utils/types";

export const createNotionClient = (auth: string) =>
  new Client({
    auth,
    notionVersion: NOTION_VERSION,
  });

// Helper: Wrap Notion API calls with reactive 401 handling
export const withTokenRefresh = async <T>(
  ctx: ActionCtx,
  organizationId: string,
  operation: (client: Client) => Promise<T>,
): Promise<T> => {
  // Get valid token (with proactive refresh if needed)
  const token = await ctx.runAction(internal.notion.actions.getValidToken, {
    organizationId,
  });

  const client = createNotionClient(token);

  try {
    return await operation(client);
  } catch (error: any) {
    // Check if it's a 401 error
    if (error?.status === 401 || error?.code === "unauthorized") {
      // Attempt token refresh
      try {
        const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
          organizationId,
        });

        if (!connection) {
          throw error;
        }

        await ctx.runAction(internal.notion.actions.refreshOAuthToken, {
          connectionId: connection._id,
        });

        // Retry with refreshed token
        const newToken = await ctx.runAction(internal.notion.actions.getValidToken, {
          organizationId,
        });

        const newClient = createNotionClient(newToken);
        return await operation(newClient);
      } catch (refreshError) {
        console.error("Token refresh failed:", refreshError);
        throw error; // Re-throw original error
      }
    }

    throw error;
  }
};
