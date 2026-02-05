export const ownerValues = [
  "Theo",
  "Phase",
  "Mir",
  "flip",
  "melkey",
  "gabriel",
  "ben",
  "shivam",
] as const;

export const channelValues = [
  "C:Main",
  "C:Rants",
  "C:Throwaways",
  "C:Other",
  "C:Main(SHORT)",
] as const;

export const labelValues = [
  "Requires Planning",
  "Priority",
  "Mid Priority",
  "Strict deadline",
  "Sponsored",
  "High Effort",
  "Worth it?",
  "Evergreen",
  "Database Week",
] as const;

export const statusValues = [
  "To Record(Off stream)",
  "To Stream",
  "Recorded",
  "Editing",
  "Done Editing",
  "NEEDS THUMBNAIL",
  "Ready To Publish",
  "Scheduled",
  "Published",
  "Concept",
  "Commited",
  "dead",
  "Shorts",
  "2nd & 3rd Channel",
  "Needs sponsor spot",
  "Theo's Problem",
  "archived",
] as const;

export type OwnerValue = (typeof ownerValues)[number];
export type ChannelValue = (typeof channelValues)[number];
export type LabelValue = (typeof labelValues)[number];
export type StatusValue = (typeof statusValues)[number];
