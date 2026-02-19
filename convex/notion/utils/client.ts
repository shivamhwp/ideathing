import { Client } from "@notionhq/client";
import type { Id } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { NOTION_VERSION } from "../../utils/types";

export const createNotionClient = (auth: string) =>
  new Client({
    auth,
    notionVersion: NOTION_VERSION,
  });

const HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const CONNECTION_DISCONNECTED_MESSAGE =
  "Notion integration is no longer connected. Please reconnect it in settings.";

export class NotionConnectionInactiveError extends Error {
  constructor(message = CONNECTION_DISCONNECTED_MESSAGE) {
    super(message);
    this.name = "NotionConnectionInactiveError";
  }
}

export const isNotionConnectionInactiveError = (error: unknown) =>
  error instanceof NotionConnectionInactiveError;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown Notion API error";

const isUnauthorizedError = (error: any) => error?.status === 401 || error?.code === "unauthorized";

const isRestrictedResourceError = (error: any) => error?.code === "restricted_resource";

const isDataSourceAccessError = (error: any) => {
  if (error?.code !== "object_not_found") return false;
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("data source") || message.includes("database");
};

const isInvalidGrantError = (error: any) => {
  const message = getErrorMessage(error).toLowerCase();
  return error?.code === "invalid_grant" || message.includes("invalid_grant");
};

const markConnectionHealth = async (
  ctx: ActionCtx,
  connectionId: Id<"notionConnections">,
  isActive: boolean,
  error?: string,
) => {
  await ctx.runMutation(internal.notion.mutations.updateConnectionHealth, {
    connectionId,
    isActive,
    checkedAt: Date.now(),
    error: error?.slice(0, 400),
  });
};

// Helper: Wrap Notion API calls with reactive 401 handling
export const withTokenRefresh = async <T>(
  ctx: ActionCtx,
  organizationId: string,
  operation: (client: Client) => Promise<T>,
): Promise<T> => {
  const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
    organizationId,
  });

  if (!connection?.accessToken) {
    throw new NotionConnectionInactiveError("No Notion connection found");
  }

  if (connection.isActive === false) {
    throw new NotionConnectionInactiveError();
  }

  // Get valid token (with proactive refresh if needed)
  const token = await ctx.runAction(internal.notion.actions.getValidToken, {
    organizationId,
  });

  const client = createNotionClient(token);

  const shouldRunHealthCheck =
    !connection.lastCheckedAt || Date.now() - connection.lastCheckedAt > HEALTH_CHECK_INTERVAL_MS;

  if (shouldRunHealthCheck) {
    try {
      await client.users.me({});
      await markConnectionHealth(ctx, connection._id, true);
    } catch (error: any) {
      if (isUnauthorizedError(error) || isRestrictedResourceError(error)) {
        await markConnectionHealth(ctx, connection._id, false, getErrorMessage(error));
        throw new NotionConnectionInactiveError();
      }
      throw error;
    }
  }

  try {
    return await operation(client);
  } catch (error: any) {
    if (isRestrictedResourceError(error) || isDataSourceAccessError(error)) {
      await markConnectionHealth(ctx, connection._id, false, getErrorMessage(error));
      throw new NotionConnectionInactiveError();
    }

    // Check if it's a 401 error
    if (isUnauthorizedError(error)) {
      // Attempt token refresh
      try {
        const latestConnection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
          organizationId,
        });

        if (!latestConnection) {
          throw new NotionConnectionInactiveError("No Notion connection found");
        }

        await ctx.runAction(internal.notion.actions.refreshOAuthToken, {
          connectionId: latestConnection._id,
        });

        // Retry with refreshed token
        const newToken = await ctx.runAction(internal.notion.actions.getValidToken, {
          organizationId,
        });

        const newClient = createNotionClient(newToken);
        await markConnectionHealth(ctx, latestConnection._id, true);
        return await operation(newClient);
      } catch (refreshError: any) {
        if (
          isNotionConnectionInactiveError(refreshError) ||
          isUnauthorizedError(refreshError) ||
          isInvalidGrantError(refreshError)
        ) {
          await markConnectionHealth(ctx, connection._id, false, getErrorMessage(refreshError));
          throw new NotionConnectionInactiveError();
        }
        console.error("Token refresh failed:", refreshError);
        throw error; // Re-throw original error
      }
    }

    throw error;
  }
};
