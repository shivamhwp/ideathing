import { APIResponseError, isFullDataSource, type Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  CreatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { requireAuth } from "../helper";
import { assertOrgAccess, assertOrgAdmin } from "../utils/auth";
import { NOTION_PROPERTY_NAMES, NOTION_VERSION } from "../utils/types";
import { normalizeNotionId } from "./utils/ids";
import { generateOAuthState } from "./utils/oauth";
import { isNotionConnectionInactiveError, withTokenRefresh } from "./utils/client";

type PropertyEntry = {
  name: string;
  type?: string;
  options?: Map<string, string>;
};

type SendConnection = Pick<
  Doc<"notionConnections">,
  | "organizationId"
  | "databaseId"
  | "targetSection"
  | "titlePropertyName"
  | "statusPropertyName"
  | "statusPropertyType"
  | "descriptionPropertyName"
>;

const MAX_SEND_RETRIES = 3;
const SEND_RETRY_DELAYS_MS = [2_000, 10_000, 30_000] as const;

const trim = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

const getType = (value: unknown) => (isRecord(value) ? getString(value.type) : undefined);

const resolveOptionName = (entry: PropertyEntry | undefined, value?: string | null) => {
  if (!entry || !value) return value ?? null;
  const match = entry.options?.get(value.toLowerCase());
  return match ?? value;
};

const addSelectProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  entry: PropertyEntry,
  value?: string | null,
) => {
  const resolved = resolveOptionName(entry, value);
  if (entry.type === "status") {
    properties[entry.name] = { status: resolved ? { name: resolved } : null };
    return;
  }
  properties[entry.name] = { select: resolved ? { name: resolved } : null };
};

const addMultiSelectProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  entry: PropertyEntry,
  values?: string[] | null,
) => {
  const resolved = (values ?? [])
    .map((value) => resolveOptionName(entry, value))
    .filter((value): value is string => Boolean(value));
  const unique = Array.from(new Set(resolved));
  properties[entry.name] = { multi_select: unique.map((name) => ({ name })) };
};

const addStatusProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  entry: PropertyEntry,
  fallbackType: "status" | "select",
  value?: string | null,
) => {
  const resolved = resolveOptionName(entry, value);
  const actualType = entry.type === "status" || entry.type === "select" ? entry.type : fallbackType;
  if (actualType === "status") {
    properties[entry.name] = { status: resolved ? { name: resolved } : null };
    return;
  }
  properties[entry.name] = { select: resolved ? { name: resolved } : null };
};

const addDateProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  name: string,
  value?: string | null,
) => {
  properties[name] = { date: value ? { start: value } : null };
};

const addNumberProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  name: string,
  value?: number | null,
) => {
  properties[name] = { number: typeof value === "number" ? value : null };
};

const addCheckboxProperty = (
  properties: NonNullable<CreatePageParameters["properties"]>,
  name: string,
  value?: boolean,
) => {
  if (typeof value !== "boolean") return;
  properties[name] = { checkbox: value };
};

const fetchDataSourceProperties = async (notion: Client, dataSourceId: string) => {
  const data = await notion.dataSources.retrieve({ data_source_id: dataSourceId });
  const properties: Record<string, unknown> = data?.properties ?? {};
  const map = new Map<string, PropertyEntry>();

  for (const [key, value] of Object.entries(properties)) {
    const entry = isRecord(value) ? value : undefined;
    const type = getType(entry);
    const selectOptions =
      type === "select" && entry && isRecord(entry.select) ? entry.select.options : undefined;
    const multiSelectOptions =
      type === "multi_select" && entry && isRecord(entry.multi_select)
        ? entry.multi_select.options
        : undefined;
    const statusOptions =
      type === "status" && entry && isRecord(entry.status) ? entry.status.options : undefined;
    const options = Array.isArray(selectOptions)
      ? selectOptions
      : Array.isArray(multiSelectOptions)
        ? multiSelectOptions
        : Array.isArray(statusOptions)
          ? statusOptions
          : undefined;
    const optionsMap = options
      ? new Map(
          options
            .map((option) => (isRecord(option) ? getString(option.name)?.trim() : undefined))
            .filter((option): option is string => Boolean(option))
            .map((option) => [option.toLowerCase(), option]),
        )
      : undefined;

    map.set(key.toLowerCase(), { name: key, type, options: optionsMap });
  }

  return map;
};

const getPropertyEntry = (propertyNames: Map<string, PropertyEntry>, name?: string | null) => {
  if (!name) return undefined;
  return propertyNames.get(name.toLowerCase());
};

const getTitlePropertyEntry = (
  propertyNames: Map<string, PropertyEntry>,
  preferredName?: string | null,
) => {
  const explicit = getPropertyEntry(propertyNames, preferredName);
  if (explicit) return explicit;
  for (const entry of propertyNames.values()) {
    if (entry.type === "title") return entry;
  }
  return undefined;
};

type TextRichText = {
  type: "text";
  text: { content: string; link?: { url: string } };
};

const createRichText = (content: string, link?: string): TextRichText[] => [
  {
    type: "text",
    text: { content, ...(link ? { link: { url: link } } : {}) },
  },
];

const getFilenameFromUrl = (url: string, contentType: string | null) => {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() || "";
    if (base && base.includes(".")) return base;
  } catch {
    // ignore invalid URLs
  }

  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  const extension = contentType ? extensionMap[contentType] : undefined;
  return extension ? `thumbnail.${extension}` : "thumbnail";
};

const isImageFile = (contentType: string | null, filename: string) => {
  if (contentType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp)$/i.test(filename);
};

const resolveThumbnailUrl = (draftThumbnail: string) => {
  if (!draftThumbnail) return null;
  if (draftThumbnail.startsWith("http://") || draftThumbnail.startsWith("https://")) {
    return draftThumbnail;
  }
  return null;
};

const buildExternalThumbnailBlock = (
  url: string,
  contentType: string | null,
  filename: string,
): BlockObjectRequest => {
  if (isImageFile(contentType, filename)) {
    return {
      object: "block",
      type: "image",
      image: { type: "external", external: { url } },
    };
  }

  return {
    object: "block",
    type: "file",
    file: { type: "external", external: { url }, name: filename },
  };
};

const buildIdeaContentBlocks = (
  idea: {
    description?: string | null;
    notes?: string | null;
    draftThumbnail?: string | null;
    resources?: string[] | null;
  },
  missingProperties?: string[],
  options?: { thumbnailBlock?: BlockObjectRequest | null; thumbnailText?: string | null },
) => {
  const blocks: BlockObjectRequest[] = [];

  const description = trim(idea.description);
  if (description) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: createRichText("Description") },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: createRichText(description) },
    });
  }

  const thumbnailText = trim(options?.thumbnailText ?? null);
  if (options?.thumbnailBlock || thumbnailText) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: createRichText("Thumbnail Draft") },
    });
    if (options?.thumbnailBlock) {
      blocks.push(options.thumbnailBlock);
    } else if (thumbnailText) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: createRichText(thumbnailText) },
      });
    }
  }

  const notes = trim(idea.notes);
  if (notes) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: createRichText("Notes") },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: createRichText(notes) },
    });
  }

  const resources = (idea.resources ?? []).map((r) => r.trim()).filter(Boolean);
  if (resources.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: createRichText("Links") },
    });

    for (const resource of resources) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: createRichText(resource, resource) },
      });
    }
  }

  if (missingProperties && missingProperties.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: createRichText("Additional Properties") },
    });

    for (const property of missingProperties) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: createRichText(property) },
      });
    }
  }

  return blocks;
};

const getThumbnailContent = (
  draftThumbnail?: string | null,
): { block: BlockObjectRequest | null; text: string | null } => {
  if (!draftThumbnail) return { block: null, text: null };

  const thumbnailUrl = resolveThumbnailUrl(draftThumbnail);
  if (!thumbnailUrl) {
    return { block: null, text: draftThumbnail };
  }

  const filename = getFilenameFromUrl(thumbnailUrl, null);
  return { block: buildExternalThumbnailBlock(thumbnailUrl, null, filename), text: null };
};

const ensurePageEditable = async (notion: Client, pageId: string) => {
  const page = await notion.pages.retrieve({ page_id: pageId });
  if (isRecord(page) && "archived" in page && page.archived === true) {
    await notion.pages.update({ page_id: pageId, archived: false });
  }
};

const writeIdeaBlocks = async ({
  pageId,
  notion,
  idea,
  missingProperties,
}: {
  pageId: string;
  notion: Client;
  idea: {
    description?: string | null;
    notes?: string | null;
    draftThumbnail?: string | null;
    resources?: string[] | null;
  };
  missingProperties?: string[];
}) => {
  const thumbnailContent = getThumbnailContent(idea.draftThumbnail);
  const children = buildIdeaContentBlocks(idea, missingProperties, {
    thumbnailBlock: thumbnailContent.block,
    thumbnailText: thumbnailContent.text,
  });
  if (children.length === 0) {
    return;
  }

  const timestampSpacer: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [] },
  };
  const timestamp: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: createRichText(
        `Sent from ideathing: ${new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}`,
      ),
    },
  };

  const nextChildren = [...children, timestampSpacer, timestamp];

  const apply = async () => {
    await ensurePageEditable(notion, pageId);
    await notion.pages.update({ page_id: pageId, erase_content: true });
    await notion.blocks.children.append({ block_id: pageId, children: nextChildren });
  };

  try {
    await apply();
  } catch (error) {
    if (
      error instanceof APIResponseError &&
      error.code === "validation_error" &&
      error.message?.toLowerCase().includes("archived")
    ) {
      await notion.pages.update({ page_id: pageId, archived: false });
      await apply();
      return;
    }
    throw error;
  }
};

const getTitleText = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => (isRecord(part) && typeof part.plain_text === "string" ? part.plain_text : ""))
    .join("")
    .trim();
};

const isTheoModeForOrganization = async (
  ctx: {
    runQuery: (...args: any[]) => Promise<any>;
  },
  organizationId: string,
) => {
  const mode = await ctx.runQuery(internal.mode.queries.getModeForScopeInternal, {
    organizationId,
  });
  return mode === "theo";
};

const ensureTheoModeForOrganization = async (
  ctx: {
    runQuery: (...args: any[]) => Promise<any>;
  },
  organizationId: string,
) => {
  const enabled = await isTheoModeForOrganization(ctx, organizationId);
  if (!enabled) {
    throw new Error("Theo mode is disabled for this workspace");
  }
};

const toSendErrorMessage = (error: unknown) => {
  if (isNotionConnectionInactiveError(error)) {
    return "Notion connection is inactive. Reconnect it in settings.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown Notion send error";
};

const isRetryableSendError = (error: unknown) => {
  if (isNotionConnectionInactiveError(error)) {
    return false;
  }

  if (error instanceof APIResponseError) {
    const code = String(error.code ?? "");
    if (error.status === 429 || error.status >= 500) {
      return true;
    }
    return [
      "rate_limited",
      "service_unavailable",
      "internal_server_error",
      "gateway_timeout",
      "conflict_error",
    ].includes(code);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("timeout") ||
      message.includes("network") ||
      message.includes("fetch failed") ||
      message.includes("temporarily unavailable")
    );
  }

  return false;
};

const buildNotionPage = async ({
  ctx,
  notion,
  ideaId,
  connection,
}: {
  ctx: Parameters<typeof withTokenRefresh>[0];
  notion: Client;
  ideaId: Id<"ideas">;
  connection: SendConnection;
}) => {
  const latestIdea = await ctx.runQuery(internal.notion.queries.getIdeaInternal, {
    ideaId,
  });
  if (!latestIdea) {
    return null;
  }

  const databaseId = connection.databaseId;
  if (!databaseId) {
    throw new Error("Notion database is not configured. Configure it in settings first.");
  }

  const propertyNames = await fetchDataSourceProperties(notion, databaseId);
  const titleEntry = getTitlePropertyEntry(propertyNames, connection.titlePropertyName || "Name");
  const statusEntry = getPropertyEntry(propertyNames, connection.statusPropertyName || "Status");
  const descriptionEntry = getPropertyEntry(
    propertyNames,
    connection.descriptionPropertyName || "Description",
  );
  const ownerEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.owner);
  const channelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.channel);
  const labelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.label);
  const potentialEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.potential);
  const thumbnailEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.thumbnailReady);
  const unsponsoredEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.unsponsored);
  const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
  const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
  const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);

  const properties: CreatePageParameters["properties"] = {};
  if (titleEntry) {
    properties[titleEntry.name] = { title: [{ text: { content: latestIdea.title } }] };
  }

  if (statusEntry) {
    addStatusProperty(
      properties,
      statusEntry,
      connection.statusPropertyType || "status",
      trim(connection.targetSection) ?? "To Stream",
    );
  }

  if (descriptionEntry) {
    const descriptionValue = trim(latestIdea.description);
    properties[descriptionEntry.name] = {
      rich_text: descriptionValue ? [{ text: { content: descriptionValue } }] : [],
    };
  }

  if (ownerEntry) addSelectProperty(properties, ownerEntry, trim(latestIdea.owner));
  if (channelEntry) addSelectProperty(properties, channelEntry, trim(latestIdea.channel));
  if (labelEntry) {
    if (labelEntry.type === "multi_select") {
      addMultiSelectProperty(properties, labelEntry, latestIdea.label ?? []);
    } else {
      addSelectProperty(properties, labelEntry, trim(latestIdea.label?.[0]));
    }
  }
  if (potentialEntry) addNumberProperty(properties, potentialEntry.name, latestIdea.potential);
  if (thumbnailEntry)
    addCheckboxProperty(properties, thumbnailEntry.name, latestIdea.thumbnailReady);
  if (unsponsoredEntry)
    addCheckboxProperty(properties, unsponsoredEntry.name, latestIdea.unsponsored);
  if (vodEntry) addDateProperty(properties, vodEntry.name, trim(latestIdea.vodRecordingDate));
  if (releaseEntry) addDateProperty(properties, releaseEntry.name, trim(latestIdea.releaseDate));
  if (notesEntry) {
    const notesValue = trim(latestIdea.notes);
    properties[notesEntry.name] = {
      rich_text: notesValue ? [{ text: { content: notesValue } }] : [],
    };
  }

  const missingProperties: string[] = [];
  if (!ownerEntry && latestIdea.owner) missingProperties.push(`Owner: ${latestIdea.owner}`);
  if (!channelEntry && latestIdea.channel) missingProperties.push(`Channel: ${latestIdea.channel}`);
  if (!labelEntry && latestIdea.label?.length) {
    missingProperties.push(`Label: ${latestIdea.label.join(", ")}`);
  }
  if (!potentialEntry && latestIdea.potential !== undefined) {
    missingProperties.push(`Potential: ${latestIdea.potential}`);
  }
  if (!thumbnailEntry && latestIdea.thumbnailReady !== undefined) {
    missingProperties.push(`Thumbnail Ready: ${latestIdea.thumbnailReady ? "Yes" : "No"}`);
  }
  if (!unsponsoredEntry && latestIdea.unsponsored !== undefined) {
    missingProperties.push(`Unsponsored: ${latestIdea.unsponsored ? "Yes" : "No"}`);
  }
  if (!vodEntry && latestIdea.vodRecordingDate) {
    missingProperties.push(`VOD Recording Date: ${latestIdea.vodRecordingDate}`);
  }
  if (!releaseEntry && latestIdea.releaseDate) {
    missingProperties.push(`Release Date: ${latestIdea.releaseDate}`);
  }

  const result = await notion.pages.create({
    parent: { type: "data_source_id", data_source_id: databaseId },
    properties,
  });

  await writeIdeaBlocks({
    pageId: result.id,
    notion,
    idea: latestIdea,
    missingProperties,
  });

  return result.id;
};

export const listDatabases = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }

    assertOrgAdmin(identity, "Only organization admins can list Notion databases");
    await ensureTheoModeForOrganization(ctx, orgId);

    const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
      organizationId: orgId,
    });

    if (connection?.isActive === false) {
      throw new Error("Notion integration is disconnected. Please reconnect.");
    }

    if (!connection?.accessToken) {
      throw new Error("Notion is not connected.");
    }

    return await withTokenRefresh(ctx, orgId, async (notion) => {
      let searchData = await notion.search({
        filter: {
          property: "object",
          value: "data_source",
        },
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
      });

      let results = searchData.results ?? [];
      if (results.length === 0) {
        searchData = await notion.search({
          sort: {
            direction: "descending",
            timestamp: "last_edited_time",
          },
        });
        results = searchData.results ?? [];
      }

      const databases: Array<{ id: string; name: string }> = [];
      for (const item of results) {
        if (!isFullDataSource(item)) continue;
        const name = getTitleText(item.title);
        databases.push({ id: item.id, name: name || "Untitled data source" });
      }

      return { databases };
    });
  },
});

export const getDataSourceSchema = action({
  args: {
    dataSourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }

    assertOrgAdmin(identity, "Only organization admins can read Notion schemas");
    await ensureTheoModeForOrganization(ctx, orgId);

    const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
      organizationId: orgId,
    });

    if (connection?.isActive === false) {
      throw new Error("Notion integration is disconnected. Please reconnect.");
    }

    if (!connection?.accessToken) {
      throw new Error("Notion is not connected.");
    }

    return await withTokenRefresh(ctx, orgId, async (notion) => {
      const data = await notion.dataSources.retrieve({
        data_source_id: args.dataSourceId,
      });

      const properties = data?.properties ?? {};
      const entries = Object.entries(properties);

      const getPropType = (prop: unknown) => (isRecord(prop) ? getString(prop.type) : undefined);
      const getPropName = (prop: unknown) => (isRecord(prop) ? getString(prop.name) : undefined);

      const titleProperty = entries.find(([, prop]) => getPropType(prop) === "title");
      const statusProperty = entries.find(([, prop]) => getPropType(prop) === "status");
      const selectProperty = entries.find(([, prop]) => getPropType(prop) === "select");
      const descriptionProperty =
        entries.find(([, prop]) => (getPropName(prop) || "").toLowerCase() === "description") ??
        entries.find(([, prop]) => getPropType(prop) === "rich_text");

      return {
        titlePropertyName: titleProperty?.[0] ?? "Name",
        statusPropertyName: (statusProperty ?? selectProperty)?.[0] ?? "Status",
        statusPropertyType: statusProperty ? "status" : selectProperty ? "select" : "status",
        descriptionPropertyName: descriptionProperty?.[0] ?? "Description",
      };
    });
  },
});

export const generateOAuthUrl = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }

    assertOrgAdmin(identity, "Only organization admins can connect Notion");
    await ensureTheoModeForOrganization(ctx, orgId);

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new Error("OAuth not configured");
    }

    const state = generateOAuthState();
    const now = Date.now();

    await ctx.runMutation(internal.notion.mutations.createOAuthState, {
      state,
      userId: identity.subject,
      organizationId: orgId,
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
    });

    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    return authUrl.toString();
  },
});

export const disconnect = action({
  args: {
    revokeRemote: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }

    assertOrgAdmin(identity, "Only organization admins can disconnect Notion");

    const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
      organizationId: orgId,
    });

    let remoteError: string | undefined;

    if (connection?.accessToken && args.revokeRemote !== false) {
      const clientId = process.env.NOTION_CLIENT_ID;
      const clientSecret = process.env.NOTION_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        remoteError = "OAuth client credentials are missing for Notion revoke.";
      } else {
        try {
          const response = await fetch("https://api.notion.com/v1/oauth/revoke", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Notion-Version": NOTION_VERSION,
              Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
            },
            body: JSON.stringify({ token: connection.accessToken }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            remoteError =
              `Notion revoke failed (${response.status}): ` + (errorText || response.statusText);
          }
        } catch (error) {
          remoteError = error instanceof Error ? error.message : "Unknown revoke error";
        }
      }
    }

    await ctx.runMutation(internal.notion.mutations.disconnectLocal, {
      organizationId: orgId,
    });

    if (remoteError) {
      console.warn("Notion remote revoke failed; local disconnect succeeded.", remoteError);
    }

    return { disconnected: true as const };
  },
});

export const refreshOAuthToken = internalAction({
  args: {
    connectionId: v.id("notionConnections"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.notion.queries.getConnectionById, {
      connectionId: args.connectionId,
    });

    if (!connection || !connection.refreshToken) {
      throw new Error("Cannot refresh: no refresh token available");
    }

    await ensureTheoModeForOrganization(ctx, connection.organizationId);

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing OAuth configuration");
    }

    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let errorCode: string | undefined;
      try {
        const parsed = JSON.parse(errorText) as { code?: string };
        errorCode = parsed.code;
      } catch {
        // keep fallback
      }

      const error = new Error(
        `Token refresh failed: ${tokenResponse.status} ${tokenResponse.statusText}${errorCode ? ` (${errorCode})` : ""}`,
      ) as Error & { code?: string; status?: number };
      error.code = errorCode;
      error.status = tokenResponse.status;
      throw error;
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    await ctx.runMutation(internal.notion.mutations.updateConnectionTokens, {
      connectionId: args.connectionId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    });

    return { success: true };
  },
});

export const getValidToken = internalAction({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    await ensureTheoModeForOrganization(ctx, args.organizationId);

    const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
      organizationId: args.organizationId,
    });

    if (!connection) {
      throw new Error("No Notion connection found");
    }
    if (connection.isActive === false) {
      throw new Error("Notion integration is disconnected. Please reconnect.");
    }

    const now = Date.now();
    const refreshThreshold = 7 * 24 * 60 * 60 * 1000;

    if (connection.expiresAt && now + refreshThreshold >= connection.expiresAt) {
      try {
        await ctx.runAction(internal.notion.actions.refreshOAuthToken, {
          connectionId: connection._id,
        });

        const updated = await ctx.runQuery(internal.notion.queries.getConnectionById, {
          connectionId: connection._id,
        });

        return updated?.accessToken || connection.accessToken;
      } catch {
        return connection.accessToken;
      }
    }

    return connection.accessToken;
  },
});

export const exchangeOAuthCode = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireAuth(ctx);

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing OAuth configuration");
    }

    const stateRecord = await ctx.runQuery(internal.notion.queries.getOAuthStateByValue, {
      state: args.state,
    });

    if (!stateRecord || stateRecord.expiresAt < Date.now()) {
      if (stateRecord) {
        await ctx.runMutation(internal.notion.mutations.deleteOAuthState, {
          stateId: stateRecord._id,
        });
      }
      throw new Error("Invalid or expired OAuth state");
    }

    assertOrgAccess(identity, stateRecord.organizationId);
    assertOrgAdmin(identity, "Only organization admins can complete Notion connection");
    await ensureTheoModeForOrganization(ctx, stateRecord.organizationId);

    if (identity.subject !== stateRecord.userId) {
      throw new Error("OAuth state mismatch");
    }

    await ctx.runMutation(internal.notion.mutations.deleteOAuthState, {
      stateId: stateRecord._id,
    });

    const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Notion token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      token_type: string;
      bot_id: string;
      workspace_id: string;
      workspace_name?: string;
      workspace_icon?: string;
    };

    await ctx.runMutation(internal.notion.mutations.saveOAuthConnection, {
      userId: stateRecord.userId,
      organizationId: stateRecord.organizationId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenType: tokenData.token_type,
      botId: tokenData.bot_id,
      workspaceId: tokenData.workspace_id,
      workspaceName: tokenData.workspace_name,
      workspaceIcon: tokenData.workspace_icon,
    });

    return { success: true };
  },
});

export const sendIdeaToNotion = action({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ success: true; status: "queued" | "already_sent" | "already_sending" }> => {
    const identity = await requireAuth(ctx);
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }

    await ensureTheoModeForOrganization(ctx, orgId);

    const idea = await ctx.runQuery(internal.notion.queries.getIdeaInternal, {
      ideaId: args.ideaId,
    });
    if (!idea) {
      throw new Error("Idea not found");
    }
    if (!idea.organizationId) {
      throw new Error("Only organization ideas can be sent to Notion");
    }

    assertOrgAccess(identity, idea.organizationId);

    const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
      organizationId: idea.organizationId,
    });

    if (
      !connection ||
      connection.isActive === false ||
      !connection.accessToken ||
      !connection.databaseId
    ) {
      throw new Error("Notion is not connected. Configure it in settings first.");
    }

    const enqueueResult = await ctx.runMutation(internal.notion.mutations.enqueueIdeaSend, {
      ideaId: args.ideaId,
      actorUserId: identity.subject,
    });

    if (!enqueueResult.queued) {
      if (enqueueResult.reason === "already_sent") {
        return { success: true, status: "already_sent" };
      }
      if (enqueueResult.reason === "already_sending") {
        return { success: true, status: "already_sending" };
      }
      throw new Error("Idea not found");
    }

    return { success: true, status: "queued" };
  },
});

export const processQueuedIdeaSend = internalAction({
  args: {
    ideaId: v.id("ideas"),
    actorUserId: v.string(),
    attempt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { success: true; skipped: "missing_idea" | "already_sent" | "not_in_sending_state" }
    | { success: true; notionPageId: string }
    | { success: false; skipped: "invalid_scope" | "not_connected" }
    | { success: false; retryScheduled: true | false }
  > => {
    const attempt = args.attempt ?? 0;

    const idea = await ctx.runQuery(internal.notion.queries.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea) {
      return { success: true as const, skipped: "missing_idea" as const };
    }

    if (idea.inNotion) {
      return { success: true as const, skipped: "already_sent" as const };
    }

    if (idea.notionSendState !== "sending") {
      return { success: true as const, skipped: "not_in_sending_state" as const };
    }

    if (!idea.organizationId) {
      await ctx.runMutation(internal.notion.mutations.markIdeaSendFailure, {
        ideaId: args.ideaId,
        error: "Only organization ideas can be sent to Notion",
      });
      return { success: false as const, skipped: "invalid_scope" as const };
    }

    try {
      await ensureTheoModeForOrganization(ctx, idea.organizationId);

      const connection = await ctx.runQuery(internal.notion.queries.getConnectionInternal, {
        organizationId: idea.organizationId,
      });

      if (
        !connection ||
        connection.isActive === false ||
        !connection.accessToken ||
        !connection.databaseId
      ) {
        await ctx.runMutation(internal.notion.mutations.markIdeaSendFailure, {
          ideaId: args.ideaId,
          error: "Notion is not connected. Configure it in settings first.",
        });
        return { success: false as const, skipped: "not_connected" as const };
      }

      const notionPageId = await withTokenRefresh(ctx, idea.organizationId, async (notion) => {
        return await buildNotionPage({
          ctx,
          notion,
          ideaId: args.ideaId,
          connection,
        });
      });

      if (!notionPageId) {
        return { success: true as const, skipped: "missing_idea" as const };
      }

      await ctx.runMutation(internal.notion.mutations.markIdeaSendSuccess, {
        ideaId: args.ideaId,
        userId: args.actorUserId,
        notionPageId,
      });

      return {
        success: true as const,
        notionPageId: normalizeNotionId(notionPageId),
      };
    } catch (error) {
      if (isRetryableSendError(error) && attempt < MAX_SEND_RETRIES) {
        const delay = SEND_RETRY_DELAYS_MS[Math.min(attempt, SEND_RETRY_DELAYS_MS.length - 1)];
        await ctx.scheduler.runAfter(delay, internal.notion.actions.processQueuedIdeaSend, {
          ideaId: args.ideaId,
          actorUserId: args.actorUserId,
          attempt: attempt + 1,
        });

        return { success: false as const, retryScheduled: true as const };
      }

      await ctx.runMutation(internal.notion.mutations.markIdeaSendFailure, {
        ideaId: args.ideaId,
        error: toSendErrorMessage(error),
      });

      return { success: false as const, retryScheduled: false as const };
    }
  },
});
