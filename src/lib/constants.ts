export const STATUS = {
  IDEA: "idea",
  TO_STREAM: "To Stream",
  RECORDED: "Recorded",
} as const;

export type IdeaStatus = (typeof STATUS)[keyof typeof STATUS];

export const OWNER = {
  THEO: "Theo",
  PHASE: "Phase",
  BEN: "Ben",
  SHIVAM: "shivam",
} as const;

export type IdeaOwner = (typeof OWNER)[keyof typeof OWNER];

export const CHANNEL = {
  MAIN: "main",
  THEO_RANTS: "theo rants",
  THEO_THROWAWAYS: "theo throwaways",
} as const;

export type IdeaChannel = (typeof CHANNEL)[keyof typeof CHANNEL];

export const LABEL = {
  HIGH: "high priority",
  MID: "mid priority",
  LOW: "low priority",
} as const;

export type IdeaLabel = (typeof LABEL)[keyof typeof LABEL];

export const AD_READ_TRACKER = {
  PLANNED: "planned",
  IN_DA_EDIT: "in da edit",
  DONE: "done",
} as const;

export type IdeaAdReadTracker = (typeof AD_READ_TRACKER)[keyof typeof AD_READ_TRACKER];

export const COLUMN = {
  IDEAS: "ideas",
  VID_IT: "vid-it",
} as const;

export type IdeaColumn = (typeof COLUMN)[keyof typeof COLUMN];
