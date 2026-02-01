import { v } from "convex/values";
import { action } from "../_generated/server";
import { internal } from "../_generated/api";
import { createNotionClient } from "./client";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

const getTitleText = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => (isRecord(part) && typeof part.plain_text === "string" ? part.plain_text : ""))
    .join("")
    .trim();
};

export const listDatabases = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: identity.subject,
    });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken) {
      throw new Error("Notion is not connected.");
    }

    const notion = createNotionClient(accessToken);
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

    let results: Array<Record<string, unknown>> = searchData.results ?? [];
    if (results.length === 0) {
      searchData = await notion.search({
        sort: {
          direction: "descending",
          timestamp: "last_edited_time",
        },
      });
      results = searchData.results ?? [];
    }

    const dataSources: Array<{ id: string; name: string }> = [];

    const dataSourceResults = results.filter(
      (item): item is Record<string, unknown> => isRecord(item) && item.object === "data_source",
    );

    for (const item of dataSourceResults) {
      const name = getTitleText(item.title);
      const id = getString(item.id) ?? "";
      if (id) {
        dataSources.push({ id, name: name || "Untitled data source" });
      }
    }

    const databaseResults = results.filter(
      (item): item is Record<string, unknown> => isRecord(item) && item.object === "database",
    );

    for (const item of databaseResults) {
      const databaseId = getString(item.id) ?? "";
      if (!databaseId) continue;

      let databaseData: Awaited<ReturnType<typeof notion.databases.retrieve>>;
      try {
        databaseData = await notion.databases.retrieve({
          database_id: databaseId,
        });
      } catch {
        continue;
      }

      const databaseName = getTitleText(item.title);

      const dataSourceList =
        databaseData && "data_sources" in databaseData && Array.isArray(databaseData.data_sources)
          ? databaseData.data_sources
          : [];

      for (const source of dataSourceList) {
        if (!isRecord(source)) continue;
        const sourceId = getString(source.id);
        if (!sourceId) continue;
        const sourceName =
          getString(source.name)?.trim() || "" || databaseName || "Untitled data source";
        dataSources.push({
          id: sourceId,
          name:
            dataSourceList.length > 1 && databaseName
              ? `${databaseName} — ${sourceName}`
              : sourceName,
        });
      }
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
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const connection = await ctx.runQuery(internal.notion.getConnectionInternal, {
      userId: identity.subject,
    });

    const accessToken = connection?.accessToken ?? connection?.integrationToken;
    if (!accessToken) {
      throw new Error("Notion is not connected.");
    }

    const notion = createNotionClient(accessToken);
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
