import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Client } from "@notionhq/client";
import { APIResponseError } from "@notionhq/client";
import { isFullDataSource } from "@notionhq/client";
import type {
  BlockObjectRequest,
  CreatePageParameters,
  GetPageResponse,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { SearchResponse } from "@notionhq/client/build/src/api-endpoints";
import type { Doc, Id } from "../_generated/dataModel";
import { createNotionClient } from "./utils/client";
import { NOTION_PROPERTY_NAMES } from "./utils/types";
import { assertOrgAccess, assertOrgAdmin} from "../utils/auth";
import { generateOAuthState } from "./utils/oauth";

const BATCH_SIZE = 10;

type PropertyEntry = {
  name: string;
  type?: string;
  options?: Map<string, string>;
};

const trim = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed || null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

const getType = (value: unknown) => (isRecord(value) ? getString(value.type) : undefined);

const getRichTextPlain = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const text = value
    .map((part) => (isRecord(part) ? (getString(part.plain_text) ?? "") : ""))
    .join("")
    .trim();
  return text || null;
};

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
  } else {
    properties[entry.name] = { select: resolved ? { name: resolved } : null };
  }
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
  } else {
    properties[entry.name] = { select: resolved ? { name: resolved } : null };
  }
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
    const statusOptions =
      type === "status" && entry && isRecord(entry.status) ? entry.status.options : undefined;
    const options = Array.isArray(selectOptions)
      ? selectOptions
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

const getNotionTitle = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "title") return null;
  return getRichTextPlain(property.title);
};

const getNotionRichText = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "rich_text") return null;
  return getRichTextPlain(property.rich_text);
};

const getNotionSelect = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "select") return null;
  if (!isRecord(property.select)) return null;
  const name = getString(property.select.name);
  return name?.trim() || null;
};

const getNotionCheckbox = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "checkbox") return undefined;
  return typeof property.checkbox === "boolean" ? property.checkbox : undefined;
};

const getNotionNumber = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "number") return undefined;
  return typeof property.number === "number" ? property.number : undefined;
};

const getNotionDate = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "date") return null;
  if (!isRecord(property.date)) return null;
  return getString(property.date.start) ?? null;
};

const getNotionStatusName = (property: unknown) => {
  if (!isRecord(property)) return null;
  const type = getType(property);
  if (type === "status" && isRecord(property.status)) {
    return getString(property.status.name)?.trim() || null;
  }
  if (type === "select" && isRecord(property.select)) {
    return getString(property.select.name)?.trim() || null;
  }
  return null;
};

type TextRichText = {
  type: "text";
  text: { content: string; link?: { url: string } };
};

const deriveStatusForNotion = (status?: string, column?: string) => {
  if (status === "Recorded") return "Recorded";
  if (status === "To Stream" || column === "To Stream") return "To Stream";
  return "Concept";
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

const isStorageId = (value: string | null | undefined) =>
  !!value && value.startsWith("k") && !value.includes("://");

const resolveThumbnailUrl = async (ctx: ActionCtx, thumbnail: string | null | undefined) => {
  if (!thumbnail) return null;
  if (isStorageId(thumbnail)) {
    const url = await ctx.runQuery(api.utils.files.getUrl, {
      storageId: thumbnail as Id<"_storage">,
    });
    return url ?? null;
  }
  if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) return thumbnail;
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

const buildSyncedContentChildren = (
  idea: {
    description?: string | null;
    notes?: string | null;
    thumbnail?: string | null;
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
    for (const prop of missingProperties) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: createRichText(prop) },
      });
    }
  }

  return blocks;
};

const getThumbnailContent = async (
  ctx: ActionCtx,
  _notion: Client,
  thumbnail?: string | null,
): Promise<{ block: BlockObjectRequest | null; text: string | null }> => {
  if (!thumbnail) return { block: null, text: null };

  const thumbnailUrl = await resolveThumbnailUrl(ctx, thumbnail);
  if (!thumbnailUrl) {
    return { block: null, text: isStorageId(thumbnail) ? null : thumbnail };
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

const upsertSyncedContent = async ({
  ctx,
  pageId,
  notion,
  idea,
  missingProperties,
}: {
  ctx: ActionCtx;
  pageId: string;
  notion: Client;
  idea: {
    description?: string | null;
    notes?: string | null;
    thumbnail?: string | null;
    resources?: string[] | null;
  };
  missingProperties?: string[];
}) => {
  const thumbnailContent = await getThumbnailContent(ctx, notion, idea.thumbnail);
  const children = buildSyncedContentChildren(idea, missingProperties, {
    thumbnailBlock: thumbnailContent.block,
    thumbnailText: thumbnailContent.text,
  });
  if (children.length === 0) return;

  const timestampSpacer: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [] },
  };
  const lastSyncedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timestampBlock: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: createRichText(`Last synced: ${lastSyncedAt}`) },
  };
  const nextChildren = [...children, timestampSpacer, timestampBlock];

  const applySync = async () => {
    await ensurePageEditable(notion, pageId);
    await notion.pages.update({ page_id: pageId, erase_content: true });
    await notion.blocks.children.append({ block_id: pageId, children: nextChildren });
  };

  try {
    await applySync();
  } catch (error) {
    if (
      error instanceof APIResponseError &&
      error.code === "validation_error" &&
      error.message?.toLowerCase().includes("archived")
    ) {
      try {
        await notion.pages.update({ page_id: pageId, archived: false });
      } catch {
        return;
      }
      await applySync();
      return;
    }
    throw error;
  }
};

const getIdeaUpdatesFromNotion = ({
  data,
  propertyNames,
  connection,
}: {
  data: GetPageResponse;
  propertyNames: Map<string, PropertyEntry>;
  connection: {
    titlePropertyName?: string | null;
    statusPropertyName?: string | null;
    descriptionPropertyName?: string | null;
  };
}) => {
  const titleEntry = getTitlePropertyEntry(propertyNames, connection.titlePropertyName || "Name");
  const statusEntry = getPropertyEntry(propertyNames, connection.statusPropertyName || "Status");
  const descriptionEntry = getPropertyEntry(
    propertyNames,
    connection.descriptionPropertyName || "Description",
  );
  const ownerEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.owner);
  const channelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.channel);
  const labelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.label);
  const adReadEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.adReadTracker);
  const potentialEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.potential);
  const thumbnailEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.thumbnailReady);
  const unsponsoredEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.unsponsored);
  const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
  const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
  const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);

  const properties: Record<string, unknown> =
    data && "properties" in data && data.properties ? data.properties : {};
  const titleProperty = titleEntry ? properties[titleEntry.name] : undefined;
  const fallbackTitleProperty = Object.values(properties).find(
    (property) => isRecord(property) && property.type === "title",
  );
  const resolvedTitleProperty = titleProperty ?? fallbackTitleProperty;
  const statusProperty = statusEntry ? properties[statusEntry.name] : undefined;
  const fallbackStatusProperty = Object.values(properties).find((property) => {
    const type = isRecord(property) ? property.type : undefined;
    return type === "status" || type === "select";
  });
  const resolvedStatusProperty = statusProperty ?? fallbackStatusProperty;
  const descriptionProperty = descriptionEntry ? properties[descriptionEntry.name] : undefined;
  const ownerProperty = ownerEntry ? properties[ownerEntry.name] : undefined;
  const channelProperty = channelEntry ? properties[channelEntry.name] : undefined;
  const labelProperty = labelEntry ? properties[labelEntry.name] : undefined;
  const adReadProperty = adReadEntry ? properties[adReadEntry.name] : undefined;
  const potentialProperty = potentialEntry ? properties[potentialEntry.name] : undefined;
  const thumbnailProperty = thumbnailEntry ? properties[thumbnailEntry.name] : undefined;
  const unsponsoredProperty = unsponsoredEntry ? properties[unsponsoredEntry.name] : undefined;
  const vodProperty = vodEntry ? properties[vodEntry.name] : undefined;
  const releaseProperty = releaseEntry ? properties[releaseEntry.name] : undefined;
  const notesProperty = notesEntry ? properties[notesEntry.name] : undefined;

  const rawStatus = getNotionStatusName(resolvedStatusProperty);
  const statusLower = rawStatus?.toLowerCase();
  const mappedStatus =
    statusLower === "recorded"
      ? "Recorded"
      : statusLower === "to stream"
        ? "To Stream"
        : statusLower === "concept" || statusLower === "idea"
          ? "Concept"
          : undefined;

  let column: "Concept" | "To Stream" | undefined;
  if (mappedStatus === "To Stream") {
    column = "To Stream";
  } else if (mappedStatus === "Concept") {
    column = "Concept";
  }

  return {
    mappedStatus,
    updates: {
      status: mappedStatus,
      column,
      title: getNotionTitle(resolvedTitleProperty) ?? undefined,
      description: getNotionRichText(descriptionProperty) ?? undefined,
      notes: getNotionRichText(notesProperty) ?? undefined,
      owner: getNotionSelect(ownerProperty) ?? undefined,
      channel: getNotionSelect(channelProperty) ?? undefined,
      label: getNotionSelect(labelProperty) ?? undefined,
      adReadTracker: getNotionSelect(adReadProperty) ?? undefined,
      potential: getNotionNumber(potentialProperty),
      thumbnailReady: getNotionCheckbox(thumbnailProperty),
      unsponsored: getNotionCheckbox(unsponsoredProperty),
      vodRecordingDate: getNotionDate(vodProperty) ?? undefined,
      releaseDate: getNotionDate(releaseProperty) ?? undefined,
    },
  };
};

const omitUndefinedUpdates = <T extends Record<string, unknown>>(updates: T) => {
  return Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  ) as T;
};

// ===== API Actions (formerly api.ts) =====

export const listDatabases = action({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity?.org_role;
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can list Notion databases");

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: orgId,
    });

    if (!connection?.accessToken) {
      throw new Error("Notion is not connected.");
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: orgId,
    });

    const notion = createNotionClient(token);
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

    let results: SearchResponse["results"] = searchData.results ?? [];
    if (results.length === 0) {
      searchData = await notion.search({
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
      });
      results = searchData.results ?? [];
    }

    const safeResults: Array<Parameters<typeof isFullDataSource>[0]> = results ?? [];
    const dataSources: Array<{ id: string; name: string }> = [];

    for (const item of safeResults) {
      if (!isFullDataSource(item)) continue;
      const name = getTitleText(item.title);
      dataSources.push({ id: item.id, name: name || "Untitled data source" });
    }

    const databases = dataSources
      .filter((item) => item && typeof item === "object")
      .map((item) => item)
      .filter((item): item is { id: string; name: string } => Boolean(item?.id));

    return { databases };
  },
});

export const getDataSourceSchema = action({
  args: {
    dataSourceId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const orgId = identity?.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can read Notion schemas");

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: orgId,
    });

    if (!connection?.accessToken) {
      throw new Error("Notion is not connected.");
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: orgId,
    });

    const notion = createNotionClient(token);
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
  },
});

export const generateOAuthUrl = action({
  args: {},
  handler: async (ctx, _args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    const orgId = identity.org_id;
    if (!orgId) {
      throw new Error("No organization context");
    }
    assertOrgAdmin(identity, "Only organization admins can connect Notion");

    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("OAuth not configured");
    }

    const state = generateOAuthState();
    const now = Date.now();
    const expiresAt = now + 10 * 60 * 1000;

    await ctx.runMutation(internal.notion.createOAuthState, {
      state,
      userId: identity.subject,
      organizationId: orgId,
      createdAt: now,
      expiresAt,
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

// Refresh OAuth token
export const refreshOAuthToken = internalAction({
  args: {
    connectionId: v.id("notionConnections"),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.notion.getConnectionById, {
      connectionId: args.connectionId,
    });

    if (!connection || !connection.refreshToken) {
      throw new Error("Cannot refresh: no refresh token available");
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing OAuth configuration");
    }

    // Refresh token
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
      console.error("Notion token refresh failed:", errorText);
      throw new Error(`Token refresh failed: ${tokenResponse.statusText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
    };

    // Update connection with new tokens
    await ctx.runMutation(internal.notion.updateConnectionTokens, {
      connectionId: args.connectionId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
    });

    return { success: true };
  },
});

// Get valid token with automatic refresh
export const getValidToken = internalAction({
  args: {
    organizationId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: args.organizationId,
    });

    if (!connection) {
      throw new Error("No Notion connection found");
    }

    // Check if token needs refresh (within 7 days of expiration)
    const now = Date.now();
    const refreshThreshold = 7 * 24 * 60 * 60 * 1000; // 7 days

    if (connection.expiresAt && now + refreshThreshold >= connection.expiresAt) {
      // Proactively refresh token
      try {
        await ctx.runAction(internal.notion.refreshOAuthToken, {
          connectionId: connection._id,
        });

        // Re-fetch updated connection
        const updated = await ctx.runQuery(internal.notion.getConnectionById, {
          connectionId: connection._id,
        });

        return updated?.accessToken || connection.accessToken;
      } catch (error) {
        console.error("Proactive token refresh failed:", error);
        // Fall back to current token (will handle 401 reactively)
      }
    }

    return connection.accessToken;
  },
});

// Exchange OAuth code for tokens
export const exchangeOAuthCode = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Missing OAuth configuration");
    }

    const stateRecord = await ctx.runQuery(internal.notion.getOAuthStateByValue, {
      state: args.state,
    });

    if (!stateRecord || stateRecord.expiresAt < Date.now()) {
      if (stateRecord) {
        await ctx.runMutation(internal.notion.deleteOAuthState, {
          stateId: stateRecord._id,
        });
      }
      throw new Error("Invalid or expired OAuth state");
    }

    assertOrgAccess(identity, stateRecord.organizationId);
    assertOrgAdmin(identity, "Only organization admins can complete Notion connection");

    if (identity.subject !== stateRecord.userId) {
      throw new Error("OAuth state mismatch");
    }

    await ctx.runMutation(internal.notion.deleteOAuthState, {
      stateId: stateRecord._id,
    });

    // Exchange code for token
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

    // Save OAuth connection
    await ctx.runMutation(internal.notion.saveOAuthConnection, {
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

// ===== Sync Actions (formerly sync.ts) =====

export const syncToNotion = internalAction({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    if (!idea) {
      return;
    }

    if (!idea.organizationId) {
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: idea.organizationId,
    });
    if (!connection) {
      return;
    }

    if (!connection.accessToken || !connection.databaseId) {
      return;
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: idea.organizationId,
    });
    const notion = createNotionClient(token);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    const titlePropertyName = connection.titlePropertyName || "Name";
    const statusPropertyName = connection.statusPropertyName || "Status";
    const statusPropertyType = connection.statusPropertyType || "status";
    const descriptionPropertyName = connection.descriptionPropertyName || "Description";
    const titleEntry = getTitlePropertyEntry(propertyNames, titlePropertyName);
    const statusEntry = getPropertyEntry(propertyNames, statusPropertyName);
    const descriptionEntry = getPropertyEntry(propertyNames, descriptionPropertyName);
    const ownerEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.owner);
    const channelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.channel);
    const labelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.label);
    const adReadEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.adReadTracker);
    const potentialEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.potential);
    const thumbnailEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.thumbnailReady);
    const unsponsoredEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.unsponsored);
    const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
    const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
    const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);
    const statusValue = trim(
      deriveStatusForNotion(idea.status, idea.column) ?? connection.targetSection,
    );

    const properties: CreatePageParameters["properties"] = {};
    if (titleEntry) {
      properties[titleEntry.name] = { title: [{ text: { content: idea.title } }] };
    }

    if (statusEntry) {
      addStatusProperty(properties, statusEntry, statusPropertyType, statusValue);
    }

    if (descriptionEntry) {
      const descriptionValue = trim(idea.description);
      properties[descriptionEntry.name] = {
        rich_text: descriptionValue ? [{ text: { content: descriptionValue } }] : [],
      };
    }

    if (ownerEntry) addSelectProperty(properties, ownerEntry, trim(idea.owner));
    if (channelEntry) addSelectProperty(properties, channelEntry, trim(idea.channel));
    if (labelEntry) addSelectProperty(properties, labelEntry, trim(idea.label));
    if (adReadEntry) addSelectProperty(properties, adReadEntry, trim(idea.adReadTracker));
    if (potentialEntry) addNumberProperty(properties, potentialEntry.name, idea.potential);
    if (thumbnailEntry) addCheckboxProperty(properties, thumbnailEntry.name, idea.thumbnailReady);
    if (unsponsoredEntry) addCheckboxProperty(properties, unsponsoredEntry.name, idea.unsponsored);
    if (vodEntry) addDateProperty(properties, vodEntry.name, trim(idea.vodRecordingDate));
    if (releaseEntry) addDateProperty(properties, releaseEntry.name, trim(idea.releaseDate));
    if (notesEntry) {
      const notesValue = trim(idea.notes);
      properties[notesEntry.name] = {
        rich_text: notesValue ? [{ text: { content: notesValue } }] : [],
      };
    }

    const missingProperties: string[] = [];
    if (!ownerEntry && idea.owner) missingProperties.push(`Owner: ${idea.owner}`);
    if (!channelEntry && idea.channel) missingProperties.push(`Channel: ${idea.channel}`);
    if (!labelEntry && idea.label) missingProperties.push(`Label: ${idea.label}`);
    if (!adReadEntry && idea.adReadTracker)
      missingProperties.push(`Ad Read Tracker: ${idea.adReadTracker}`);
    if (!potentialEntry && idea.potential !== undefined)
      missingProperties.push(`Potential: ${idea.potential}`);
    if (!thumbnailEntry && idea.thumbnailReady !== undefined)
      missingProperties.push(`Thumbnail Ready: ${idea.thumbnailReady ? "Yes" : "No"}`);
    if (!unsponsoredEntry && idea.unsponsored !== undefined)
      missingProperties.push(`Unsponsored: ${idea.unsponsored ? "Yes" : "No"}`);
    if (!vodEntry && idea.vodRecordingDate)
      missingProperties.push(`VOD Recording Date: ${idea.vodRecordingDate}`);
    if (!releaseEntry && idea.releaseDate)
      missingProperties.push(`Release Date: ${idea.releaseDate}`);

    const data = await notion.pages.create({
      parent: { type: "data_source_id", data_source_id: connection.databaseId },
      properties,
    });

    await upsertSyncedContent({ ctx, pageId: data.id, notion, idea, missingProperties });

    await ctx.runMutation(internal.notion.updateIdeaSynced, {
      ideaId: args.ideaId,
      notionPageId: data.id,
    });
  },
});

export const syncStatusesFromNotion = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const orgId = (identity as { org_id?: string }).org_id;
    if (!orgId) return { updated: 0 };

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: orgId,
    });
    if (!connection) return { updated: 0 };

    if (!connection.accessToken || !connection.databaseId) return { updated: 0 };

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);
    const ideas = await ctx.runQuery(internal.notion.listIdeasWithNotion, {
      organizationId: orgId,
    });

    let updated = 0;

    for (let i = 0; i < ideas.length; i += BATCH_SIZE) {
      const batch = ideas.slice(i, i + BATCH_SIZE);
      const ideasWithNotion = batch.filter(
        (idea): idea is Doc<"ideas"> & { notionPageId: string } => Boolean(idea.notionPageId),
      );
      const results = await Promise.all(
        ideasWithNotion.map(async (idea) => {
          try {
            const data = await notion.pages.retrieve({ page_id: idea.notionPageId });
            return { idea, data };
          } catch {
            return null;
          }
        }),
      );

      for (const result of results) {
        if (!result) continue;

        const { idea, data } = result;
        const { updates } = getIdeaUpdatesFromNotion({ data, propertyNames, connection });
        const payload = omitUndefinedUpdates(updates);
        if (Object.keys(payload).length === 0) continue;
        await ctx.runMutation(internal.notion.updateIdeaFromNotion, {
          ideaId: idea._id,
          ...payload,
        });
        updated += 1;
      }
    }

    return { updated };
  },
});

export const syncIdeaFromNotionPage = internalAction({
  args: {
    notionPageId: v.string(),
    ideaId: v.optional(v.id("ideas")),
    organizationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let idea;
    if (args.ideaId) {
      idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    } else {
      idea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
        notionPageId: args.notionPageId,
      });
    }

    if (!idea) {
      return;
    }

    const organizationId = args.organizationId ?? idea.organizationId;
    if (!organizationId) {
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId,
    });

    if (!connection?.accessToken || !connection?.databaseId) {
      return;
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    let data: GetPageResponse;
    try {
      data = await notion.pages.retrieve({ page_id: args.notionPageId });
    } catch {
      return;
    }

    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    const { updates } = getIdeaUpdatesFromNotion({ data, propertyNames, connection });
    const payload = omitUndefinedUpdates(updates);
    if (Object.keys(payload).length === 0) {
      return;
    }
    await ctx.runMutation(internal.notion.updateIdeaFromNotion, {
      ideaId: idea._id,
      ...payload,
    });
  },
});

export const deleteFromNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
    organizationId: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });

    const organizationId = idea?.organizationId ?? args.organizationId;
    const notionPageId = idea?.notionPageId ?? args.notionPageId;

    if (!organizationId || !notionPageId) return;

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId,
    });
    if (!connection?.accessToken) return;

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    try {
      await notion.pages.update({ page_id: notionPageId, archived: true });
    } catch {
      return;
    }

    if (idea) {
      await ctx.runMutation(internal.notion.clearIdeaSynced, { ideaId: args.ideaId });
    }
  },
});

export const createIdeaFromNotionPage = internalAction({
  args: {
    notionPageId: v.string(),
    databaseId: v.string(),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.notion.getConnectionByDatabaseId, {
      databaseId: args.databaseId,
    });

    if (!connection) {
      return;
    }

    const existingIdea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
      notionPageId: args.notionPageId,
    });

    if (existingIdea) {
      await ctx.scheduler.runAfter(0, internal.notion.syncIdeaFromNotionPage, {
        notionPageId: args.notionPageId,
        ideaId: existingIdea._id,
        organizationId: existingIdea.organizationId,
      });
      return;
    }

    if (!connection.accessToken) {
      return;
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    let data: GetPageResponse;
    try {
      data = await notion.pages.retrieve({ page_id: args.notionPageId });
    } catch {
      return;
    }

    const propertyNames = await fetchDataSourceProperties(notion, args.databaseId);
    const { updates } = getIdeaUpdatesFromNotion({ data, propertyNames, connection });

    const title = updates.title || "Untitled";
    const column = updates.column || "Concept";

    await ctx.runMutation(internal.notion.createIdeaFromWebhook, {
      organizationId: connection.organizationId,
      userId: connection.createdBy,
      notionPageId: args.notionPageId,
      title,
      description: updates.description,
      notes: updates.notes,
      status: updates.status as Doc<"ideas">["status"],
      column,
      owner: updates.owner as Doc<"ideas">["owner"],
      channel: updates.channel as Doc<"ideas">["channel"],
      label: updates.label as Doc<"ideas">["label"],
      adReadTracker: updates.adReadTracker as Doc<"ideas">["adReadTracker"],
      potential: updates.potential,
      thumbnailReady: updates.thumbnailReady,
      unsponsored: updates.unsponsored,
      vodRecordingDate: updates.vodRecordingDate,
      releaseDate: updates.releaseDate,
    });
  },
});

export const handleNotionPageDeleted = internalAction({
  args: {
    ideaId: v.id("ideas"),
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    if (!idea) {
      return;
    }

    if (!idea.organizationId) {
      await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: idea.organizationId,
    });

    if (!connection?.accessToken) {
      await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
      return;
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    try {
      const page = await notion.pages.retrieve({ page_id: args.notionPageId });
      if ("archived" in page && page.archived === true) {
        await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
      } else {
        await ctx.scheduler.runAfter(0, internal.notion.syncIdeaFromNotionPage, {
          notionPageId: args.notionPageId,
          ideaId: args.ideaId,
          organizationId: idea.organizationId,
        });
      }
    } catch {
      await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
    }
  },
});

export const syncFromDataSource = internalAction({
  args: {
    dataSourceId: v.string(),
    workspaceId: v.optional(v.string()),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const connection = await ctx.runQuery(internal.notion.getConnectionByDatabaseId, {
      databaseId: args.dataSourceId,
    });

    if (!connection) {
      return;
    }

    if (!connection.accessToken) {
      return;
    }

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    const propertyNames = await fetchDataSourceProperties(notion, args.dataSourceId);

    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await notion.dataSources.query({
        data_source_id: args.dataSourceId,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of response.results) {
        if (!("properties" in page)) continue;

        const pageId = page.id;
        const existingIdea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
          notionPageId: pageId,
        });

        const { updates } = getIdeaUpdatesFromNotion({
          data: page as GetPageResponse,
          propertyNames,
          connection,
        });

        if (existingIdea) {
          const payload = omitUndefinedUpdates(updates);
          if (Object.keys(payload).length > 0) {
            await ctx.runMutation(internal.notion.updateIdeaFromNotion, {
              ideaId: existingIdea._id,
              ...payload,
            });
          }
        } else {
          const title = updates.title || "Untitled";
          const column = updates.column || "Concept";

          await ctx.runMutation(internal.notion.createIdeaFromWebhook, {
            organizationId: connection.organizationId,
            userId: connection.createdBy,
            notionPageId: pageId,
            title,
            description: updates.description,
            notes: updates.notes,
            status: updates.status as Doc<"ideas">["status"],
            column,
            owner: updates.owner as Doc<"ideas">["owner"],
            channel: updates.channel as Doc<"ideas">["channel"],
            label: updates.label as Doc<"ideas">["label"],
            adReadTracker: updates.adReadTracker as Doc<"ideas">["adReadTracker"],
            potential: updates.potential,
            thumbnailReady: updates.thumbnailReady,
            unsponsored: updates.unsponsored,
            vodRecordingDate: updates.vodRecordingDate,
            releaseDate: updates.releaseDate,
          });
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }
  },
});

export const updateInNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
    syncContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });

    if (!idea || !idea.notionPageId || !idea.organizationId) return;

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      organizationId: idea.organizationId,
    });
    if (!connection?.accessToken || !connection.databaseId) return;

    const token = await ctx.runAction(internal.notion.getValidToken, {
      organizationId: connection.organizationId,
    });
    const notion = createNotionClient(token);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    const titlePropertyName = connection.titlePropertyName || "Name";
    const statusPropertyName = connection.statusPropertyName || "Status";
    const statusPropertyType = connection.statusPropertyType || "status";
    const descriptionPropertyName = connection.descriptionPropertyName || "Description";
    const titleEntry = getTitlePropertyEntry(propertyNames, titlePropertyName);
    const statusEntry = getPropertyEntry(propertyNames, statusPropertyName);
    const descriptionEntry = getPropertyEntry(propertyNames, descriptionPropertyName);
    const ownerEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.owner);
    const channelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.channel);
    const labelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.label);
    const adReadEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.adReadTracker);
    const potentialEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.potential);
    const thumbnailEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.thumbnailReady);
    const unsponsoredEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.unsponsored);
    const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
    const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
    const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);
    const statusValue = trim(
      deriveStatusForNotion(idea.status, idea.column) ?? connection.targetSection,
    );

    const properties: UpdatePageParameters["properties"] = {};
    if (titleEntry) {
      properties[titleEntry.name] = { title: [{ text: { content: idea.title } }] };
    }

    if (statusEntry) {
      addStatusProperty(properties, statusEntry, statusPropertyType, statusValue);
    }

    if (descriptionEntry) {
      const descriptionValue = trim(idea.description);
      properties[descriptionEntry.name] = {
        rich_text: descriptionValue ? [{ text: { content: descriptionValue } }] : [],
      };
    }

    if (ownerEntry) addSelectProperty(properties, ownerEntry, trim(idea.owner));
    if (channelEntry) addSelectProperty(properties, channelEntry, trim(idea.channel));
    if (labelEntry) addSelectProperty(properties, labelEntry, trim(idea.label));
    if (adReadEntry) addSelectProperty(properties, adReadEntry, trim(idea.adReadTracker));
    if (potentialEntry) addNumberProperty(properties, potentialEntry.name, idea.potential);
    if (thumbnailEntry) addCheckboxProperty(properties, thumbnailEntry.name, idea.thumbnailReady);
    if (unsponsoredEntry) addCheckboxProperty(properties, unsponsoredEntry.name, idea.unsponsored);
    if (vodEntry) addDateProperty(properties, vodEntry.name, trim(idea.vodRecordingDate));
    if (releaseEntry) addDateProperty(properties, releaseEntry.name, trim(idea.releaseDate));
    if (notesEntry) {
      const notesValue = trim(idea.notes);
      properties[notesEntry.name] = {
        rich_text: notesValue ? [{ text: { content: notesValue } }] : [],
      };
    }

    const missingProperties: string[] = [];
    if (!ownerEntry && idea.owner) missingProperties.push(`Owner: ${idea.owner}`);
    if (!channelEntry && idea.channel) missingProperties.push(`Channel: ${idea.channel}`);
    if (!labelEntry && idea.label) missingProperties.push(`Label: ${idea.label}`);
    if (!adReadEntry && idea.adReadTracker)
      missingProperties.push(`Ad Read Tracker: ${idea.adReadTracker}`);
    if (!potentialEntry && idea.potential !== undefined)
      missingProperties.push(`Potential: ${idea.potential}`);
    if (!thumbnailEntry && idea.thumbnailReady !== undefined)
      missingProperties.push(`Thumbnail Ready: ${idea.thumbnailReady ? "Yes" : "No"}`);
    if (!unsponsoredEntry && idea.unsponsored !== undefined)
      missingProperties.push(`Unsponsored: ${idea.unsponsored ? "Yes" : "No"}`);
    if (!vodEntry && idea.vodRecordingDate)
      missingProperties.push(`VOD Recording Date: ${idea.vodRecordingDate}`);
    if (!releaseEntry && idea.releaseDate)
      missingProperties.push(`Release Date: ${idea.releaseDate}`);

    try {
      await ensurePageEditable(notion, idea.notionPageId);
      await notion.pages.update({ page_id: idea.notionPageId, properties });
    } catch (error) {
      if (
        error instanceof APIResponseError &&
        error.code === "validation_error" &&
        error.message?.toLowerCase().includes("archived")
      ) {
        try {
          await notion.pages.update({ page_id: idea.notionPageId, archived: false });
          await notion.pages.update({ page_id: idea.notionPageId, properties });
        } catch {
          return;
        }
      } else {
        return;
      }
    }

    if (args.syncContent !== false) {
      await upsertSyncedContent({
        ctx,
        pageId: idea.notionPageId,
        notion,
        idea,
        missingProperties,
      });
    }

    await ctx.runMutation(internal.notion.updateIdeaSynced, {
      ideaId: args.ideaId,
      notionPageId: idea.notionPageId,
    });
  },
});

// Helper function from api.ts
const getTitleText = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => (isRecord(part) && typeof part.plain_text === "string" ? part.plain_text : ""))
    .join("")
    .trim();
};
