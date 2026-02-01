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
import { NOTION_PROPERTY_NAMES, type NotionPropertyEntry } from "./types";
import {
  addCheckboxProperty,
  addDateProperty,
  addNumberProperty,
  addSelectProperty,
  addStatusProperty,
  fetchDataSourceProperties,
  getNotionCheckbox,
  getNotionDate,
  getNotionNumber,
  getNotionRichText,
  getNotionSelect,
  getNotionStatusName,
  getNotionTitle,
  getPropertyEntry,
  getTitlePropertyEntry,
  normalizeAdReadTracker,
  normalizeChannel,
  normalizeIdeaStatus,
  normalizeLabel,
  normalizeOwner,
  normalizeText,
} from "./utils";

const BATCH_SIZE = 10;
const MAX_NOTION_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const isStorageId = (value: string | null | undefined): value is Id<"_storage"> =>
  !!value && value.startsWith("k") && !value.includes("://");

type NotionPageData = GetPageResponse;

type NotionBlock = BlockObjectRequest;

type TextRichText = {
  type: "text";
  text: { content: string; link?: { url: string } };
};

type IdeaUpdates = {
  column?: "Concept" | "To Stream";
  status?: string;
  title?: string;
  description?: string;
  notes?: string;
  owner?: "Theo" | "Phase" | "Ben" | "shivam";
  channel?: "main" | "theo rants" | "theo throwaways";
  label?: "mid priority" | "low priority" | "high priority";
  adReadTracker?: "planned" | "in da edit" | "done";
  potential?: number;
  thumbnailReady?: boolean;
  unsponsored?: boolean;
  vodRecordingDate?: string;
  releaseDate?: string;
};

const deriveStatusForNotion = (status?: string, column?: string): string => {
  if (status === "Recorded") return "Recorded";
  if (status === "To Stream" || column === "To Stream") return "To Stream";
  return "Concept";
};

const createRichText = (content: string, link?: string): TextRichText[] => [
  {
    type: "text",
    text: {
      content,
      ...(link ? { link: { url: link } } : {}),
    },
  },
];

const sanitizeContentType = (value: string | null) => value?.split(";")[0]?.trim() || null;

const getFilenameFromUrl = (url: string, contentType: string | null) => {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop() || "";
    if (base && base.includes(".")) {
      return base;
    }
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
  if (contentType?.startsWith("image/")) {
    return true;
  }

  return /\.(png|jpe?g|gif|webp)$/i.test(filename);
};

const resolveThumbnailUrl = async (
  ctx: ActionCtx,
  thumbnail: string | null | undefined,
): Promise<string | null> => {
  if (!thumbnail) {
    return null;
  }

  if (isStorageId(thumbnail)) {
    const url = await ctx.runQuery(api.files.getUrl, {
      storageId: thumbnail,
    });
    return url ?? null;
  }

  if (thumbnail.startsWith("http://") || thumbnail.startsWith("https://")) {
    return thumbnail;
  }

  return null;
};

const uploadFileToNotion = async (
  notion: Client,
  url: string,
): Promise<{
  fileUploadId: string;
  contentType: string | null;
  filename: string;
} | null> => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const contentType = sanitizeContentType(response.headers.get("content-type"));
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (Number.isFinite(length) && length > MAX_NOTION_FILE_SIZE) {
      return null;
    }
  }

  const data = await response.arrayBuffer();
  if (data.byteLength > MAX_NOTION_FILE_SIZE) {
    return null;
  }

  const filename = getFilenameFromUrl(url, contentType);

  let upload;
  try {
    upload = await notion.fileUploads.create({
      mode: "single_part",
      filename,
      content_type: contentType ?? undefined,
    });
  } catch {
    return null;
  }

  try {
    await notion.fileUploads.send({
      file_upload_id: upload.id,
      file: {
        data: new Blob([data], {
          type: contentType ?? "application/octet-stream",
        }),
        filename,
      },
    });
  } catch {
    return null;
  }

  return {
    fileUploadId: upload.id,
    contentType,
    filename,
  };
};

const buildThumbnailBlock = (
  fileUploadId: string,
  contentType: string | null,
  filename: string,
): NotionBlock => {
  const isImage = isImageFile(contentType, filename);

  if (isImage) {
    return {
      object: "block",
      type: "image",
      image: {
        type: "file_upload",
        file_upload: {
          id: fileUploadId,
        },
      },
    };
  }

  return {
    object: "block",
    type: "file",
    file: {
      type: "file_upload",
      file_upload: {
        id: fileUploadId,
      },
      name: filename,
    },
  };
};

const buildExternalThumbnailBlock = (
  url: string,
  contentType: string | null,
  filename: string,
): NotionBlock => {
  const isImage = isImageFile(contentType, filename);

  if (isImage) {
    return {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: {
          url,
        },
      },
    };
  }

  return {
    object: "block",
    type: "file",
    file: {
      type: "external",
      external: {
        url,
      },
      name: filename,
    },
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
  options?: {
    thumbnailBlock?: NotionBlock | null;
    thumbnailText?: string | null;
  },
) => {
  const blocks: NotionBlock[] = [];

  // Description section
  const description = normalizeText(idea.description);
  if (description) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Description"),
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: createRichText(description),
      },
    });
  }

  // Thumbnail Draft section
  const thumbnailText = normalizeText(options?.thumbnailText ?? null);
  if (options?.thumbnailBlock || thumbnailText) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Thumbnail Draft"),
      },
    });
    if (options?.thumbnailBlock) {
      blocks.push(options.thumbnailBlock);
    } else if (thumbnailText) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: createRichText(thumbnailText),
        },
      });
    }
  }

  // Notes section
  const notes = normalizeText(idea.notes);
  if (notes) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Notes"),
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: createRichText(notes),
      },
    });
  }

  // Links section (renamed from Resources)
  const resources = (idea.resources ?? []).map((resource) => resource.trim()).filter(Boolean);
  if (resources.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Links"),
      },
    });
    for (const resource of resources) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: createRichText(resource, resource),
        },
      });
    }
  }

  // Missing Properties section (fallback for properties not in Notion schema)
  if (missingProperties && missingProperties.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Additional Properties"),
      },
    });
    for (const prop of missingProperties) {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: createRichText(prop),
        },
      });
    }
  }

  return blocks;
};

const getThumbnailContent = async (
  ctx: ActionCtx,
  notion: Client,
  thumbnail?: string | null,
): Promise<{ block: NotionBlock | null; text: string | null }> => {
  if (!thumbnail) {
    return { block: null, text: null };
  }

  const thumbnailUrl = await resolveThumbnailUrl(ctx, thumbnail);
  if (!thumbnailUrl) {
    return {
      block: null,
      text: isStorageId(thumbnail) ? null : thumbnail,
    };
  }

  const uploaded = await uploadFileToNotion(notion, thumbnailUrl);
  if (uploaded) {
    return {
      block: buildThumbnailBlock(uploaded.fileUploadId, uploaded.contentType, uploaded.filename),
      text: null,
    };
  }

  if (isStorageId(thumbnail)) {
    return { block: null, text: null };
  }

  const filename = getFilenameFromUrl(thumbnailUrl, null);
  return {
    block: buildExternalThumbnailBlock(thumbnailUrl, null, filename),
    text: null,
  };
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
      if (
        typeof block === "object" &&
        block !== null &&
        "id" in block &&
        typeof block.id === "string"
      ) {
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
  if (children.length === 0) {
    return;
  }

  const timestampSpacer: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: [],
    },
  };
  const lastSyncedAt = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timestampBlock: BlockObjectRequest = {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: createRichText(`Last synced: ${lastSyncedAt}`),
    },
  };
  const nextChildren = [...children, timestampSpacer, timestampBlock];

  const existingBlocks = await fetchAllBlockChildren(pageId, notion);
  for (const block of existingBlocks) {
    // Skip archived blocks - they can't be deleted
    if (!block.archived) {
      await notion.blocks.delete({ block_id: block.id });
    }
  }

  await notion.blocks.children.append({
    block_id: pageId,
    children: nextChildren,
  });
};

const getIdeaUpdatesFromNotion = ({
  data,
  propertyNames,
  connection,
}: {
  data: NotionPageData;
  propertyNames: Map<string, NotionPropertyEntry>;
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
    (property) =>
      typeof property === "object" &&
      property !== null &&
      "type" in property &&
      property.type === "title",
  );
  const resolvedTitleProperty = titleProperty ?? fallbackTitleProperty;
  const statusProperty = statusEntry ? properties[statusEntry.name] : undefined;
  const fallbackStatusProperty = Object.values(properties).find((property) => {
    const type =
      typeof property === "object" && property !== null && "type" in property
        ? property.type
        : undefined;
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
  const mappedStatus = normalizeIdeaStatus(rawStatus);

  // Derive column from Notion status
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
      owner: normalizeOwner(getNotionSelect(ownerProperty) ?? null),
      channel: normalizeChannel(getNotionSelect(channelProperty) ?? null),
      label: normalizeLabel(getNotionSelect(labelProperty) ?? null),
      adReadTracker: normalizeAdReadTracker(getNotionSelect(adReadProperty) ?? null),
      potential: getNotionNumber(potentialProperty),
      thumbnailReady: getNotionCheckbox(thumbnailProperty),
      unsponsored: getNotionCheckbox(unsponsoredProperty),
      vodRecordingDate: getNotionDate(vodProperty) ?? undefined,
      releaseDate: getNotionDate(releaseProperty) ?? undefined,
    },
  };
};

const omitUndefinedUpdates = (updates: IdeaUpdates): IdeaUpdates => {
  const payload: IdeaUpdates = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.column !== undefined) payload.column = updates.column;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.notes !== undefined) payload.notes = updates.notes;
  if (updates.owner !== undefined) payload.owner = updates.owner;
  if (updates.channel !== undefined) payload.channel = updates.channel;
  if (updates.label !== undefined) payload.label = updates.label;
  if (updates.adReadTracker !== undefined) payload.adReadTracker = updates.adReadTracker;
  if (updates.potential !== undefined) payload.potential = updates.potential;
  if (updates.thumbnailReady !== undefined) payload.thumbnailReady = updates.thumbnailReady;
  if (updates.unsponsored !== undefined) payload.unsponsored = updates.unsponsored;
  if (updates.vodRecordingDate !== undefined) payload.vodRecordingDate = updates.vodRecordingDate;
  if (updates.releaseDate !== undefined) payload.releaseDate = updates.releaseDate;
  return payload;
};

export const syncToNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    console.log("syncToNotion: Starting sync for idea", args.ideaId);

    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

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
    const statusValue = normalizeText(
      deriveStatusForNotion(idea.status, idea.column) ?? connection.targetSection,
    );
    const descriptionValue = normalizeText(idea.description);
    const notesValue = normalizeText(idea.notes);
    const ownerValue = normalizeText(idea.owner);
    const channelValue = normalizeText(idea.channel);
    const labelValue = normalizeText(idea.label);
    const adReadValue = normalizeText(idea.adReadTracker);
    const vodRecordingDate = normalizeText(idea.vodRecordingDate);
    const releaseDate = normalizeText(idea.releaseDate);

    const properties: CreatePageParameters["properties"] = {};
    if (titleEntry) {
      properties[titleEntry.name] = {
        title: [
          {
            text: {
              content: idea.title,
            },
          },
        ],
      };
    }

    if (statusEntry) {
      addStatusProperty(properties, statusEntry, statusPropertyType, statusValue);
    }

    if (descriptionEntry) {
      properties[descriptionEntry.name] = {
        rich_text: descriptionValue
          ? [
              {
                text: {
                  content: descriptionValue,
                },
              },
            ]
          : [],
      };
    }

    if (ownerEntry) {
      addSelectProperty(properties, ownerEntry, ownerValue);
    }
    if (channelEntry) {
      addSelectProperty(properties, channelEntry, channelValue);
    }
    if (labelEntry) {
      addSelectProperty(properties, labelEntry, labelValue);
    }
    if (adReadEntry) {
      addSelectProperty(properties, adReadEntry, adReadValue);
    }
    if (potentialEntry) {
      addNumberProperty(properties, potentialEntry.name, idea.potential);
    }
    if (thumbnailEntry) {
      addCheckboxProperty(properties, thumbnailEntry.name, idea.thumbnailReady);
    }
    if (unsponsoredEntry) {
      addCheckboxProperty(properties, unsponsoredEntry.name, idea.unsponsored);
    }
    if (vodEntry) {
      addDateProperty(properties, vodEntry.name, vodRecordingDate);
    }
    if (releaseEntry) {
      addDateProperty(properties, releaseEntry.name, releaseDate);
    }
    if (notesEntry) {
      properties[notesEntry.name] = {
        rich_text: notesValue
          ? [
              {
                text: {
                  content: notesValue,
                },
              },
            ]
          : [],
      };
    }

    // Track properties that don't exist in Notion schema
    const missingProperties: string[] = [];
    if (!ownerEntry && idea.owner) {
      missingProperties.push(`Owner: ${idea.owner}`);
    }
    if (!channelEntry && idea.channel) {
      missingProperties.push(`Channel: ${idea.channel}`);
    }
    if (!labelEntry && idea.label) {
      missingProperties.push(`Label: ${idea.label}`);
    }
    if (!adReadEntry && idea.adReadTracker) {
      missingProperties.push(`Ad Read Tracker: ${idea.adReadTracker}`);
    }
    if (!potentialEntry && idea.potential !== undefined) {
      missingProperties.push(`Potential: ${idea.potential}`);
    }
    if (!thumbnailEntry && idea.thumbnailReady !== undefined) {
      missingProperties.push(`Thumbnail Ready: ${idea.thumbnailReady ? "Yes" : "No"}`);
    }
    if (!unsponsoredEntry && idea.unsponsored !== undefined) {
      missingProperties.push(`Unsponsored: ${idea.unsponsored ? "Yes" : "No"}`);
    }
    if (!vodEntry && idea.vodRecordingDate) {
      missingProperties.push(`VOD Recording Date: ${idea.vodRecordingDate}`);
    }
    if (!releaseEntry && idea.releaseDate) {
      missingProperties.push(`Release Date: ${idea.releaseDate}`);
    }

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
        parent: {
          type: "data_source_id",
          data_source_id: connection.databaseId,
        },
        properties,
      });
      console.log("syncToNotion: Page created successfully", data.id);
    } catch (error) {
      console.error("syncToNotion: Failed to create page", error);
      throw error;
    }

    await upsertSyncedContent({
      ctx,
      pageId: data.id,
      notion,
      idea,
      missingProperties,
    });

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
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: identity.subject,
    });

    if (!connection) {
      return { updated: 0 };
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken || !connection.databaseId) {
      return { updated: 0 };
    }

    const notion = createNotionClient(accessToken);
    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);
    const ideas = await ctx.runQuery(internal.notion.listIdeasWithNotion, {
      userId: identity.subject,
    });

    let updated = 0;

    // Process in batches to avoid N+1 issue
    for (let i = 0; i < ideas.length; i += BATCH_SIZE) {
      const batch = ideas.slice(i, i + BATCH_SIZE);
      const ideasWithNotion = batch.filter(
        (idea): idea is Doc<"ideas"> & { notionPageId: string } => Boolean(idea.notionPageId),
      );
      const results = await Promise.all(
        ideasWithNotion.map(async (idea) => {
          try {
            const data = await notion.pages.retrieve({
              page_id: idea.notionPageId,
            });
            return { idea, data };
          } catch {
            return null;
          }
        }),
      );

      for (const result of results) {
        if (!result) continue;

        const { idea, data } = result;
        const { updates } = getIdeaUpdatesFromNotion({
          data,
          propertyNames,
          connection,
        });
        const payload = omitUndefinedUpdates(updates);
        if (Object.keys(payload).length === 0) {
          continue;
        }
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
  },
  handler: async (ctx, args) => {
    // Normalize page ID (remove dashes for comparison)
    const normalizedPageId = args.notionPageId.replace(/-/g, "");
    console.log("syncIdeaFromNotionPage: Starting sync for page", args.notionPageId);

    // Try both with and without dashes
    let idea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
      notionPageId: args.notionPageId,
    });

    if (!idea) {
      // Try normalized version
      idea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
        notionPageId: normalizedPageId,
      });
    }

    if (!idea) {
      console.log("syncIdeaFromNotionPage: No idea found for notionPageId", args.notionPageId);
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken || !connection?.databaseId) {
      console.log("syncIdeaFromNotionPage: No connection or database for user", idea.userId);
      return;
    }

    const notion = createNotionClient(accessToken);
    let data: NotionPageData;
    try {
      data = await notion.pages.retrieve({
        page_id: args.notionPageId,
      });
    } catch (error) {
      console.log(
        "syncIdeaFromNotionPage: Failed to retrieve Notion page",
        args.notionPageId,
        error,
      );
      return;
    }

    const propertyNames = await fetchDataSourceProperties(notion, connection.databaseId);

    const { updates } = getIdeaUpdatesFromNotion({
      data,
      propertyNames,
      connection,
    });
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
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    const userId = idea?.userId ?? args.userId;
    const notionPageId = idea?.notionPageId ?? args.notionPageId;

    if (!userId || !notionPageId) {
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId,
    });

    if (!connection) {
      return;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken) {
      return;
    }

    const notion = createNotionClient(accessToken);
    try {
      await notion.pages.update({
        page_id: notionPageId,
        archived: true,
      });
    } catch {
      return;
    }

    if (idea) {
      await ctx.runMutation(internal.notion.clearIdeaSynced, {
        ideaId: args.ideaId,
      });
    }
  },
});

export const updateInNotion = internalAction({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea || !idea.notionPageId) {
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    if (!connection) {
      return;
    }

    const accessToken = connection.accessToken ?? connection.integrationToken;
    if (!accessToken || !connection.databaseId) {
      return;
    }

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
    const statusValue = normalizeText(
      deriveStatusForNotion(idea.status, idea.column) ?? connection.targetSection,
    );
    const descriptionValue = normalizeText(idea.description);
    const notesValue = normalizeText(idea.notes);
    const ownerValue = normalizeText(idea.owner);
    const channelValue = normalizeText(idea.channel);
    const labelValue = normalizeText(idea.label);
    const adReadValue = normalizeText(idea.adReadTracker);
    const vodRecordingDate = normalizeText(idea.vodRecordingDate);
    const releaseDate = normalizeText(idea.releaseDate);

    const properties: UpdatePageParameters["properties"] = {};
    if (titleEntry) {
      properties[titleEntry.name] = {
        title: [
          {
            text: {
              content: idea.title,
            },
          },
        ],
      };
    }

    if (statusEntry) {
      addStatusProperty(properties, statusEntry, statusPropertyType, statusValue);
    }

    if (descriptionEntry) {
      properties[descriptionEntry.name] = {
        rich_text: descriptionValue
          ? [
              {
                text: {
                  content: descriptionValue,
                },
              },
            ]
          : [],
      };
    }

    if (ownerEntry) {
      addSelectProperty(properties, ownerEntry, ownerValue);
    }
    if (channelEntry) {
      addSelectProperty(properties, channelEntry, channelValue);
    }
    if (labelEntry) {
      addSelectProperty(properties, labelEntry, labelValue);
    }
    if (adReadEntry) {
      addSelectProperty(properties, adReadEntry, adReadValue);
    }
    if (potentialEntry) {
      addNumberProperty(properties, potentialEntry.name, idea.potential);
    }
    if (thumbnailEntry) {
      addCheckboxProperty(properties, thumbnailEntry.name, idea.thumbnailReady);
    }
    if (unsponsoredEntry) {
      addCheckboxProperty(properties, unsponsoredEntry.name, idea.unsponsored);
    }
    if (vodEntry) {
      addDateProperty(properties, vodEntry.name, vodRecordingDate);
    }
    if (releaseEntry) {
      addDateProperty(properties, releaseEntry.name, releaseDate);
    }
    if (notesEntry) {
      properties[notesEntry.name] = {
        rich_text: notesValue
          ? [
              {
                text: {
                  content: notesValue,
                },
              },
            ]
          : [],
      };
    }

    // Track properties that don't exist in Notion schema
    const missingProperties: string[] = [];
    if (!ownerEntry && idea.owner) {
      missingProperties.push(`Owner: ${idea.owner}`);
    }
    if (!channelEntry && idea.channel) {
      missingProperties.push(`Channel: ${idea.channel}`);
    }
    if (!labelEntry && idea.label) {
      missingProperties.push(`Label: ${idea.label}`);
    }
    if (!adReadEntry && idea.adReadTracker) {
      missingProperties.push(`Ad Read Tracker: ${idea.adReadTracker}`);
    }
    if (!potentialEntry && idea.potential !== undefined) {
      missingProperties.push(`Potential: ${idea.potential}`);
    }
    if (!thumbnailEntry && idea.thumbnailReady !== undefined) {
      missingProperties.push(`Thumbnail Ready: ${idea.thumbnailReady ? "Yes" : "No"}`);
    }
    if (!unsponsoredEntry && idea.unsponsored !== undefined) {
      missingProperties.push(`Unsponsored: ${idea.unsponsored ? "Yes" : "No"}`);
    }
    if (!vodEntry && idea.vodRecordingDate) {
      missingProperties.push(`VOD Recording Date: ${idea.vodRecordingDate}`);
    }
    if (!releaseEntry && idea.releaseDate) {
      missingProperties.push(`Release Date: ${idea.releaseDate}`);
    }

    try {
      await notion.pages.update({
        page_id: idea.notionPageId,
        properties,
      });
    } catch {
      return;
    }

    await upsertSyncedContent({
      ctx,
      pageId: idea.notionPageId,
      notion,
      idea,
      missingProperties,
    });

    await ctx.runMutation(internal.notion.updateIdeaSynced, {
      ideaId: args.ideaId,
      notionPageId: idea.notionPageId,
    });
  },
});
