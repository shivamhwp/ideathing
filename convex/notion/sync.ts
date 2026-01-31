import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Client } from "@notionhq/client";
import type {
  BlockObjectRequest,
  BlockObjectResponse,
  CalloutBlockObjectResponse,
  CreatePageParameters,
  GetPageResponse,
  PartialBlockObjectResponse,
  UpdatePageParameters,
} from "@notionhq/client/build/src/api-endpoints";
import type { Doc } from "../_generated/dataModel";
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

type NotionPageData = GetPageResponse;

type NotionBlock = BlockObjectRequest;

type TextRichText = {
  type: "text";
  text: { content: string; link?: { url: string } };
};

type IdeaUpdates = {
  status?: "idea" | "To Stream" | "Recorded";
  title?: string;
  description?: string;
  notes?: string;
  owner?: "Theo" | "Phase" | "Ben";
  channel?: "main" | "theo rants" | "theo throwaways";
  label?: "mid priority" | "low priority" | "high priority";
  adReadTracker?: "planned" | "in da edit" | "done";
  potential?: number;
  thumbnailReady?: boolean;
  unsponsored?: boolean;
  vodRecordingDate?: string;
  releaseDate?: string;
};

const getRichTextPlain = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) =>
      typeof part === "object" &&
      part !== null &&
      "plain_text" in part &&
      typeof part.plain_text === "string"
        ? part.plain_text
        : ""
    )
    .join("")
    .trim();
};

const SYNCED_CONTENT_TITLE = "Synced content";

const createRichText = (content: string, link?: string): TextRichText[] => [
  {
    type: "text",
    text: {
      content,
      ...(link ? { link: { url: link } } : {}),
    },
  },
];

const buildSyncedContentChildren = (idea: {
  notes?: string | null;
  resources?: string[] | null;
}) => {
  const blocks: NotionBlock[] = [];
  const notes = normalizeText(idea.notes);
  const resources = (idea.resources ?? []).map((resource) => resource.trim()).filter(Boolean);

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

  if (resources.length > 0) {
    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: createRichText("Resources"),
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

  return blocks;
};

const fetchAllBlockChildren = async (blockId: string, notion: Client) => {
  const results: Array<{ id: string }> = [];
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
        results.push({ id: block.id });
      }
    }
    cursor = data?.has_more ? data?.next_cursor : null;
  } while (cursor);

  return results;
};

const upsertSyncedContent = async ({
  pageId,
  notion,
  idea,
}: {
  pageId: string;
  notion: Client;
  idea: { notes?: string | null; resources?: string[] | null };
}) => {
  const children = buildSyncedContentChildren(idea);
  if (children.length === 0) {
    return;
  }

  const listData = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  });
  const blocks = Array.isArray(listData?.results) ? listData.results : [];
  const isCalloutBlock = (
    block: PartialBlockObjectResponse | BlockObjectResponse
  ): block is CalloutBlockObjectResponse => "type" in block && block.type === "callout";
  const syncedBlock = blocks.find(
    (block) => isCalloutBlock(block) && getRichTextPlain(block.callout.rich_text) === SYNCED_CONTENT_TITLE
  );
  const syncedBlockId = syncedBlock?.id ?? null;

  if (syncedBlockId) {
    const existingChildren = await fetchAllBlockChildren(syncedBlockId, notion);
    for (const child of existingChildren) {
      await notion.blocks.delete({ block_id: child.id });
    }

    await notion.blocks.children.append({
      block_id: syncedBlockId,
      children,
    });
    return;
  }

  const appendResponse = await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: createRichText(SYNCED_CONTENT_TITLE),
        },
      },
    ],
  });
  const calloutId = appendResponse.results[0]?.id;
  if (calloutId) {
    await notion.blocks.children.append({
      block_id: calloutId,
      children,
    });
  }
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
  const titleEntry = getTitlePropertyEntry(
    propertyNames,
    connection.titlePropertyName || "Name"
  );
  const statusEntry = getPropertyEntry(
    propertyNames,
    connection.statusPropertyName || "Status"
  );
  const descriptionEntry = getPropertyEntry(
    propertyNames,
    connection.descriptionPropertyName || "Description"
  );
  const ownerEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.owner);
  const channelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.channel);
  const labelEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.label);
  const adReadEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.adReadTracker);
  const potentialEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.potential);
  const thumbnailEntry = getPropertyEntry(
    propertyNames,
    NOTION_PROPERTY_NAMES.thumbnailReady
  );
  const unsponsoredEntry = getPropertyEntry(
    propertyNames,
    NOTION_PROPERTY_NAMES.unsponsored
  );
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
      property.type === "title"
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
  const descriptionProperty = descriptionEntry
    ? properties[descriptionEntry.name]
    : undefined;
  const ownerProperty = ownerEntry ? properties[ownerEntry.name] : undefined;
  const channelProperty = channelEntry ? properties[channelEntry.name] : undefined;
  const labelProperty = labelEntry ? properties[labelEntry.name] : undefined;
  const adReadProperty = adReadEntry ? properties[adReadEntry.name] : undefined;
  const potentialProperty = potentialEntry ? properties[potentialEntry.name] : undefined;
  const thumbnailProperty = thumbnailEntry ? properties[thumbnailEntry.name] : undefined;
  const unsponsoredProperty = unsponsoredEntry
    ? properties[unsponsoredEntry.name]
    : undefined;
  const vodProperty = vodEntry ? properties[vodEntry.name] : undefined;
  const releaseProperty = releaseEntry ? properties[releaseEntry.name] : undefined;
  const notesProperty = notesEntry ? properties[notesEntry.name] : undefined;

  const rawStatus = getNotionStatusName(resolvedStatusProperty);

  const mappedStatus = normalizeIdeaStatus(rawStatus);

  return {
    mappedStatus,
    updates: {
      status: mappedStatus,
      title: getNotionTitle(resolvedTitleProperty) ?? undefined,
      description: getNotionRichText(descriptionProperty) ?? undefined,
      notes: getNotionRichText(notesProperty) ?? undefined,
      owner: normalizeOwner(
        getNotionSelect(ownerProperty) ?? null
      ),
      channel: normalizeChannel(
        getNotionSelect(channelProperty) ?? null
      ),
      label: normalizeLabel(
        getNotionSelect(labelProperty) ?? null
      ),
      adReadTracker: normalizeAdReadTracker(
        getNotionSelect(adReadProperty) ?? null
      ),
      potential: getNotionNumber(potentialProperty),
      thumbnailReady: getNotionCheckbox(thumbnailProperty),
      unsponsored: getNotionCheckbox(unsponsoredProperty),
      vodRecordingDate: getNotionDate(vodProperty) ?? undefined,
      releaseDate: getNotionDate(releaseProperty) ?? undefined,
    },
  };
};

const restrictUpdatesToToStream = (updates: IdeaUpdates, mappedStatus?: string) => {
  if (mappedStatus !== "To Stream") {
    return { status: updates.status };
  }
  return updates;
};

const omitUndefinedUpdates = (updates: IdeaUpdates): IdeaUpdates => {
  const payload: IdeaUpdates = {};
  if (updates.status !== undefined) payload.status = updates.status;
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
    const idea = await ctx.runQuery(internal.notion.getIdeaInternal, {
      ideaId: args.ideaId,
    });

    if (!idea) {
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
    const propertyNames = await fetchDataSourceProperties(
      notion,
      connection.databaseId
    );

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
    const thumbnailEntry = getPropertyEntry(
      propertyNames,
      NOTION_PROPERTY_NAMES.thumbnailReady
    );
    const unsponsoredEntry = getPropertyEntry(
      propertyNames,
      NOTION_PROPERTY_NAMES.unsponsored
    );
    const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
    const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
    const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);
    const statusValue = normalizeText(idea.status ?? connection.targetSection);
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

    const data = await notion.pages.create({
      parent: {
        type: "data_source_id",
        data_source_id: connection.databaseId,
      },
      properties,
    });

    const syncedChildren = buildSyncedContentChildren(idea);
    if (syncedChildren.length > 0) {
      const appendResponse = await notion.blocks.children.append({
        block_id: data.id,
        children: [
          {
            object: "block",
            type: "callout",
            callout: {
              rich_text: createRichText(SYNCED_CONTENT_TITLE),
            },
          },
        ],
      });
      const calloutId = appendResponse.results[0]?.id;
      if (calloutId) {
        await notion.blocks.children.append({
          block_id: calloutId,
          children: syncedChildren,
        });
      }
    }

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
    const propertyNames = await fetchDataSourceProperties(
      notion,
      connection.databaseId
    );
    const ideas = await ctx.runQuery(internal.notion.listIdeasWithNotion, {
      userId: identity.subject,
    });

    let updated = 0;

    // Process in batches to avoid N+1 issue
    for (let i = 0; i < ideas.length; i += BATCH_SIZE) {
      const batch = ideas.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch
          .filter((idea): idea is Doc<"ideas"> & { notionPageId: string } => Boolean(idea.notionPageId))
          .map(async (idea) => {
            try {
              const data = await notion.pages.retrieve({
                page_id: idea.notionPageId,
              });
              return { idea, data };
            } catch {
              return null;
            }
          })
      );

      for (const result of results) {
        if (!result) continue;

        const { idea, data } = result;
        const { mappedStatus, updates } = getIdeaUpdatesFromNotion({
          data,
          propertyNames,
          connection,
        });
        const scopedUpdates = restrictUpdatesToToStream(updates, mappedStatus);
        const payload = omitUndefinedUpdates(scopedUpdates);
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
    const idea = await ctx.runQuery(internal.notion.getIdeaByNotionPageId, {
      notionPageId: args.notionPageId,
    });

    if (!idea) {
      return;
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: idea.userId,
    });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken || !connection?.databaseId) {
      return;
    }

    const notion = createNotionClient(accessToken);
    let data: NotionPageData;
    try {
      data = await notion.pages.retrieve({
        page_id: args.notionPageId,
      });
    } catch {
      return;
    }

    const propertyNames = await fetchDataSourceProperties(
      notion,
      connection.databaseId
    );

    const { mappedStatus, updates } = getIdeaUpdatesFromNotion({
      data,
      propertyNames,
      connection,
    });
    const scopedUpdates = restrictUpdatesToToStream(updates, mappedStatus);
    const payload = omitUndefinedUpdates(scopedUpdates);
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
    if (!accessToken) {
      return;
    }

    const notion = createNotionClient(accessToken);
    try {
      await notion.pages.update({
        page_id: idea.notionPageId,
        archived: true,
      });
    } catch {
      return;
    }

    await ctx.runMutation(internal.notion.clearIdeaSynced, {
      ideaId: args.ideaId,
    });
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
    const propertyNames = await fetchDataSourceProperties(
      notion,
      connection.databaseId
    );

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
    const thumbnailEntry = getPropertyEntry(
      propertyNames,
      NOTION_PROPERTY_NAMES.thumbnailReady
    );
    const unsponsoredEntry = getPropertyEntry(
      propertyNames,
      NOTION_PROPERTY_NAMES.unsponsored
    );
    const vodEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.vodRecordingDate);
    const releaseEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.releaseDate);
    const notesEntry = getPropertyEntry(propertyNames, NOTION_PROPERTY_NAMES.notes);
    const statusValue = normalizeText(idea.status ?? connection.targetSection);
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

    try {
      await notion.pages.update({
        page_id: idea.notionPageId,
        properties,
      });
    } catch {
      return;
    }

    await upsertSyncedContent({
      pageId: idea.notionPageId,
      notion,
      idea,
    });

    await ctx.runMutation(internal.notion.updateIdeaSynced, {
      ideaId: args.ideaId,
      notionPageId: idea.notionPageId,
    });
  },
});

// Internal queries and mutations
export const getIdeaInternal = internalQuery({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.ideaId);
  },
});

export const listIdeasWithNotion = internalQuery({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return ideas.filter((idea) => Boolean(idea.notionPageId));
  },
});

export const getIdeaByNotionPageId = internalQuery({
  args: {
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ideas")
      .withIndex("by_notion_page", (q) => q.eq("notionPageId", args.notionPageId))
      .first();
  },
});

export const updateIdeaSynced = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    notionPageId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      notionPageId: args.notionPageId,
      syncedAt: Date.now(),
    });
  },
});

export const clearIdeaSynced = internalMutation({
  args: {
    ideaId: v.id("ideas"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.ideaId, {
      notionPageId: undefined,
      syncedAt: undefined,
    });
  },
});

export const updateIdeaFromNotion = internalMutation({
  args: {
    ideaId: v.id("ideas"),
    status: v.optional(v.union(v.literal("idea"), v.literal("To Stream"), v.literal("Recorded"))),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    notes: v.optional(v.string()),
    owner: v.optional(v.union(v.literal("Theo"), v.literal("Phase"), v.literal("Ben"))),
    channel: v.optional(
      v.union(v.literal("main"), v.literal("theo rants"), v.literal("theo throwaways"))
    ),
    label: v.optional(
      v.union(
        v.literal("mid priority"),
        v.literal("low priority"),
        v.literal("high priority")
      )
    ),
    adReadTracker: v.optional(
      v.union(v.literal("planned"), v.literal("in da edit"), v.literal("done"))
    ),
    potential: v.optional(v.number()),
    thumbnailReady: v.optional(v.boolean()),
    unsponsored: v.optional(v.boolean()),
    vodRecordingDate: v.optional(v.string()),
    releaseDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const idea = await ctx.db.get(args.ideaId);
    if (!idea) {
      return;
    }

    const updates = Object.fromEntries(
      Object.entries({
        status: args.status,
        title: args.title,
        description: args.description,
        notes: args.notes,
        owner: args.owner,
        channel: args.channel,
        label: args.label,
        adReadTracker: args.adReadTracker,
        potential: args.potential,
        thumbnailReady: args.thumbnailReady,
        unsponsored: args.unsponsored,
        vodRecordingDate: args.vodRecordingDate,
        releaseDate: args.releaseDate,
      }).filter(([_, value]) => value !== undefined)
    );

    let nextColumn: "ideas" | "vid-it" | undefined;
    let nextOrder: number | undefined;
    if (args.status && args.status !== idea.status) {
      if (args.status === "To Stream" && idea.column !== "vid-it") {
        nextColumn = "vid-it";
      } else if (args.status === "idea" && idea.column !== "ideas") {
        nextColumn = "ideas";
      }
    }

    if (nextColumn) {
      const columnIdeas = await ctx.db
        .query("ideas")
        .withIndex("by_user_column", (q) =>
          q.eq("userId", idea.userId).eq("column", nextColumn),
        )
        .collect();
      const maxOrder = columnIdeas.reduce((max, entry) => Math.max(max, entry.order), -1);
      nextOrder = maxOrder + 1;
    }

    const updatesWithColumn = Object.fromEntries(
      Object.entries({
        ...updates,
        column: nextColumn,
        order: nextOrder,
      }).filter(([_, value]) => value !== undefined)
    );

    if (Object.keys(updatesWithColumn).length === 0) {
      return;
    }

    await ctx.db.patch(args.ideaId, updatesWithColumn);
  },
});
