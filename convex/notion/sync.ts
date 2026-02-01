import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import type { Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  CreatePageParameters,
  GetPageResponse,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { Doc, Id } from "../_generated/dataModel";
import { createNotionClient } from "./client";
import { NOTION_PROPERTY_NAMES } from "./types";

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
    const url = await ctx.runQuery(api.files.getUrl, {
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

const fetchAllBlockChildren = async (blockId: string, notion: Client) => {
  const results: Array<{ id: string; archived: boolean }> = [];
  let cursor: string | null | undefined = undefined;

  do {
    const data = await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor ?? undefined,
    });
    const pageResults = Array.isArray(data?.results) ? data.results : [];
    for (const block of pageResults) {
      if (isRecord(block) && "id" in block && typeof block.id === "string") {
        results.push({
          id: block.id,
          archived: "archived" in block ? Boolean(block.archived) : false,
        });
      }
    }
    cursor = data?.has_more ? data?.next_cursor : null;
  } while (cursor);

  return results;
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

  const existingBlocks = await fetchAllBlockChildren(pageId, notion);
  for (const block of existingBlocks) {
    if (!block.archived) {
      await notion.blocks.delete({ block_id: block.id });
    }
  }

  await notion.blocks.children.append({ block_id: pageId, children: nextChildren });
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

export const syncToNotion = internalAction({
  args: { ideaId: v.id("ideas") },
  handler: async (ctx, args) => {
    console.log("syncToNotion: Starting sync for idea", args.ideaId);

    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    if (!idea) {
      console.log("syncToNotion: Idea not found");
      return;
    }

    console.log("syncToNotion: Idea found", {
      title: idea.title,
      column: idea.column,
      status: idea.status,
    });

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });
    if (!connection) {
      console.log("syncToNotion: No connection found for user");
      return;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken || !connection.databaseId) {
      console.log("syncToNotion: No access token or database ID", {
        hasToken: !!accessToken,
        databaseId: connection.databaseId,
      });
      return;
    }

    console.log("syncToNotion: Using database", connection.databaseId);

    const notion = createNotionClient(accessToken);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    console.log("syncToNotion: Found properties", Array.from(propertyNames.keys()));

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

    console.log("syncToNotion: Creating page with properties", {
      titleEntry: titleEntry?.name,
      statusEntry: statusEntry?.name,
      statusValue,
      propertyKeys: Object.keys(properties),
      missingProperties,
    });

    let data;
    try {
      data = await notion.pages.create({
        parent: { type: "data_source_id", data_source_id: connection.databaseId },
        properties,
      });
      console.log("syncToNotion: Page created successfully", data.id);
    } catch (error) {
      console.error("syncToNotion: Failed to create page", error);
      throw error;
    }

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

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: identity.subject,
    });
    if (!connection) return { updated: 0 };

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken || !connection.databaseId) return { updated: 0 };

    const notion = createNotionClient(accessToken);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);
    const ideas = await ctx.runQuery(internal.notion.listIdeasWithNotion, {
      userId: identity.subject,
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
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("syncIdeaFromNotionPage: Starting sync for page", args.notionPageId);

    let idea;
    if (args.ideaId) {
      idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    } else {
      idea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
        notionPageId: args.notionPageId,
      });
    }

    if (!idea) {
      console.log("syncIdeaFromNotionPage: No idea found for notionPageId", args.notionPageId);
      return;
    }

    console.log("syncIdeaFromNotionPage: Found idea", {
      ideaId: idea._id,
      storedNotionPageId: idea.notionPageId,
      currentStatus: idea.status,
    });

    const userId = args.userId ?? idea.userId;
    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, { userId });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken || !connection?.databaseId) {
      console.log("syncIdeaFromNotionPage: No connection or database for user", idea.userId);
      return;
    }

    const notion = createNotionClient(accessToken);
    let data: GetPageResponse;
    try {
      data = await notion.pages.retrieve({ page_id: args.notionPageId });
    } catch (error) {
      console.log(
        "syncIdeaFromNotionPage: Failed to retrieve Notion page",
        args.notionPageId,
        error,
      );
      return;
    }

    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    const { updates } = getIdeaUpdatesFromNotion({ data, propertyNames, connection });
    const payload = omitUndefinedUpdates(updates);
    if (Object.keys(payload).length === 0) {
      console.log("syncIdeaFromNotionPage: No updates to apply for page", args.notionPageId);
      return;
    }

    console.log("syncIdeaFromNotionPage: Applying updates", payload);
    await ctx.runMutation(internal.notion.updateIdeaFromNotion, {
      ideaId: idea._id,
      ...payload,
    });
  },
});

export const deleteFromNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
    userId: v.optional(v.string()),
    notionPageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });

    const userId = idea?.userId ?? args.userId;
    const notionPageId = idea?.notionPageId ?? args.notionPageId;

    if (!userId || !notionPageId) return;

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, { userId });
    if (!connection) return;

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) return;

    const notion = createNotionClient(accessToken);
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
    console.log("createIdeaFromNotionPage: Starting for page", args.notionPageId);

    const connection = await ctx.runQuery(internal.notion.getConnectionByDatabaseId, {
      databaseId: args.databaseId,
    });

    if (!connection) {
      console.log("createIdeaFromNotionPage: No connection found for database", args.databaseId);
      return;
    }

    const existingIdea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
      notionPageId: args.notionPageId,
    });

    if (existingIdea) {
      console.log("createIdeaFromNotionPage: Idea already exists, syncing instead");
      await ctx.scheduler.runAfter(0, internal.notion.syncIdeaFromNotionPage, {
        notionPageId: args.notionPageId,
        ideaId: existingIdea._id,
        userId: existingIdea.userId,
      });
      return;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) {
      console.log("createIdeaFromNotionPage: No access token");
      return;
    }

    const notion = createNotionClient(accessToken);
    let data: GetPageResponse;
    try {
      data = await notion.pages.retrieve({ page_id: args.notionPageId });
    } catch (error) {
      console.log("createIdeaFromNotionPage: Failed to retrieve page", error);
      return;
    }

    const propertyNames = await fetchDataSourceProperties(notion, args.databaseId);
    const { updates } = getIdeaUpdatesFromNotion({ data, propertyNames, connection });

    const title = updates.title || "Untitled";
    const column = updates.column || "Concept";

    console.log("createIdeaFromNotionPage: Creating idea", { title, column });

    await ctx.runMutation(internal.notion.createIdeaFromWebhook, {
      userId: connection.userId,
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
    console.log("handleNotionPageDeleted: Processing", { ideaId: args.ideaId });

    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });
    if (!idea) {
      console.log("handleNotionPageDeleted: Idea not found");
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken) {
      console.log("handleNotionPageDeleted: No access token, marking as archived");
      await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
      return;
    }

    const notion = createNotionClient(accessToken);
    try {
      const page = await notion.pages.retrieve({ page_id: args.notionPageId });
      if ("archived" in page && page.archived === true) {
        console.log("handleNotionPageDeleted: Page is archived in Notion, archiving idea");
        await ctx.runMutation(internal.notion.archiveIdeaFromNotion, { ideaId: args.ideaId });
      } else {
        console.log("handleNotionPageDeleted: Page exists and not archived, syncing instead");
        await ctx.scheduler.runAfter(0, internal.notion.syncIdeaFromNotionPage, {
          notionPageId: args.notionPageId,
          ideaId: args.ideaId,
          userId: idea.userId,
        });
      }
    } catch {
      console.log("handleNotionPageDeleted: Could not retrieve page, marking as archived");
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
    console.log("syncFromDataSource: Starting", {
      dataSourceId: args.dataSourceId,
      eventType: args.eventType,
    });

    const connection = await ctx.runQuery(internal.notion.getConnectionByDatabaseId, {
      databaseId: args.dataSourceId,
    });

    if (!connection) {
      console.log("syncFromDataSource: No connection found for data source", args.dataSourceId);
      return;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) {
      console.log("syncFromDataSource: No access token");
      return;
    }

    const notion = createNotionClient(accessToken);
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
            userId: connection.userId,
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

    console.log("syncFromDataSource: Completed");
  },
});

export const updateInNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
    syncContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, { ideaId: args.ideaId });

    if (!idea || !idea.notionPageId) return;

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });
    if (!connection) return;

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken || !connection.databaseId) return;

    const notion = createNotionClient(accessToken);
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
      await notion.pages.update({ page_id: idea.notionPageId, properties });
    } catch {
      return;
    }

    if (args.syncContent !== false) {
      await upsertSyncedContent({ ctx, pageId: idea.notionPageId, notion, idea, missingProperties });
    }

    await ctx.runMutation(internal.notion.updateIdeaSynced, {
      ideaId: args.ideaId,
      notionPageId: idea.notionPageId,
    });
  },
});
