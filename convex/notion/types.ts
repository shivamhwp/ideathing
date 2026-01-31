export const NOTION_VERSION = "2025-09-03";

export const NOTION_PROPERTY_NAMES = {
  owner: "Owner",
  channel: "Channel",
  label: "Label",
  adReadTracker: "Ad Track Reader",
  potential: "Potential",
  thumbnailReady: "Thumbnail",
  unsponsored: "Unsponsored",
  vodRecordingDate: "VOD Recording Date",
  releaseDate: "Release Date",
  notes: "Notes",
} as const;

export type IdeaStatus = "idea" | "To Stream" | "Recorded";
export type IdeaOwner = "Theo" | "Phase" | "Ben" | "shivam";
export type IdeaChannel = "main" | "theo rants" | "theo throwaways";
export type IdeaLabel = "mid priority" | "low priority" | "high priority";
export type IdeaAdReadTracker = "planned" | "in da edit" | "done";

export type NotionPropertyEntry = {
  name: string;
  type?: string;
  options?: Map<string, string>;
};
