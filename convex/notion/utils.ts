import type { Client } from "@notionhq/client";
import type { CreatePageParameters } from "@notionhq/client/build/src/api-endpoints";
import type {
  IdeaAdReadTracker,
  IdeaChannel,
  IdeaLabel,
  IdeaOwner,
  IdeaStatus,
  NotionPropertyEntry,
} from "./types";

export const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const normalizeIdeaStatus = (value?: string | null): IdeaStatus | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "recorded") return "Recorded";
  if (normalized === "to stream") return "To Stream";
  if (normalized === "idea") return "idea";
  return undefined;
};

export const normalizeOwner = (value?: string | null): IdeaOwner | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "theo") return "Theo";
  if (normalized === "phase") return "Phase";
  if (normalized === "ben") return "Ben";
  return undefined;
};

export const normalizeChannel = (value?: string | null): IdeaChannel | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "main") return "main";
  if (normalized === "theo rants") return "theo rants";
  if (normalized === "theo throwaways") return "theo throwaways";
  return undefined;
};

export const normalizeLabel = (value?: string | null): IdeaLabel | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "high priority") return "high priority";
  if (normalized === "mid priority") return "mid priority";
  if (normalized === "low priority") return "low priority";
  return undefined;
};

export const normalizeAdReadTracker = (
  value?: string | null
): IdeaAdReadTracker | undefined => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "planned") return "planned";
  if (normalized === "in da edit") return "in da edit";
  if (normalized === "done") return "done";
  return undefined;
};

type NotionProperties = NonNullable<CreatePageParameters["properties"]>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getString = (value: unknown) => (typeof value === "string" ? value : undefined);

const getRichTextPlain = (value: unknown) => {
  if (!Array.isArray(value)) return null;
  const text = value
    .map((part) => (isRecord(part) ? getString(part.plain_text) ?? "" : ""))
    .join("")
    .trim();
  return text || null;
};

const getType = (value: unknown) =>
  isRecord(value) ? getString(value.type) : undefined;

export const resolveOptionName = (
  entry: NotionPropertyEntry | undefined,
  value?: string | null
) => {
  if (!entry || !value) return value ?? null;
  const match = entry.options?.get(value.toLowerCase());
  return match ?? value;
};

export const addSelectProperty = (
  properties: NotionProperties,
  entry: NotionPropertyEntry,
  value?: string | null
) => {
  const resolved = resolveOptionName(entry, value);
  // Use actual type from Notion schema, fallback to select
  if (entry.type === "status") {
    properties[entry.name] = {
      status: resolved ? { name: resolved } : null,
    };
  } else {
    properties[entry.name] = {
      select: resolved ? { name: resolved } : null,
    };
  }
};

export const addStatusProperty = (
  properties: NotionProperties,
  entry: NotionPropertyEntry,
  fallbackType: "status" | "select",
  value?: string | null
) => {
  const resolved = resolveOptionName(entry, value);
  const actualType =
    entry.type === "status" || entry.type === "select" ? entry.type : fallbackType;
  if (actualType === "status") {
    properties[entry.name] = {
      status: resolved ? { name: resolved } : null,
    };
    return;
  }
  properties[entry.name] = {
    select: resolved ? { name: resolved } : null,
  };
};

export const addDateProperty = (
  properties: NotionProperties,
  name: string,
  value?: string | null
) => {
  properties[name] = {
    date: value ? { start: value } : null,
  };
};

export const addNumberProperty = (
  properties: NotionProperties,
  name: string,
  value?: number | null
) => {
  properties[name] = {
    number: typeof value === "number" ? value : null,
  };
};

export const addCheckboxProperty = (
  properties: NotionProperties,
  name: string,
  value?: boolean
) => {
  if (typeof value !== "boolean") return;
  properties[name] = {
    checkbox: value,
  };
};

export const fetchDataSourceProperties = async (
  notion: Client,
  dataSourceId: string
) => {
  const data = await notion.dataSources.retrieve({
    data_source_id: dataSourceId,
  });
  const properties: Record<string, unknown> = data?.properties ?? {};
  const map = new Map<string, NotionPropertyEntry>();

  for (const [key, value] of Object.entries(properties)) {
    const entry = isRecord(value) ? value : undefined;
    const type = getType(entry);
    const selectOptions =
      type === "select" && entry && isRecord(entry.select)
        ? entry.select.options
        : undefined;
    const statusOptions =
      type === "status" && entry && isRecord(entry.status)
        ? entry.status.options
        : undefined;
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
            .map((option) => [option.toLowerCase(), option])
        )
      : undefined;

    map.set(key.toLowerCase(), {
      name: key,
      type,
      options: optionsMap,
    });
  }

  return map;
};

export const getPropertyEntry = (
  propertyNames: Map<string, NotionPropertyEntry>,
  name?: string | null
) => {
  if (!name) return undefined;
  return propertyNames.get(name.toLowerCase());
};

export const getTitlePropertyEntry = (
  propertyNames: Map<string, NotionPropertyEntry>,
  preferredName?: string | null
) => {
  const explicit = getPropertyEntry(propertyNames, preferredName);
  if (explicit) return explicit;
  for (const entry of propertyNames.values()) {
    if (entry.type === "title") {
      return entry;
    }
  }
  return undefined;
};

export const getNotionTitle = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "title") return null;
  return getRichTextPlain(property.title);
};

export const getNotionRichText = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "rich_text") return null;
  return getRichTextPlain(property.rich_text);
};

export const getNotionSelect = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "select") return null;
  if (!isRecord(property.select)) return null;
  const name = getString(property.select.name);
  return name?.trim() || null;
};

export const getNotionCheckbox = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "checkbox") return undefined;
  return typeof property.checkbox === "boolean" ? property.checkbox : undefined;
};

export const getNotionNumber = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "number") return undefined;
  return typeof property.number === "number" ? property.number : undefined;
};

export const getNotionDate = (property: unknown) => {
  if (!isRecord(property) || getType(property) !== "date") return null;
  if (!isRecord(property.date)) return null;
  const start = getString(property.date.start);
  return start ?? null;
};

export const getNotionStatusName = (property: unknown) => {
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
