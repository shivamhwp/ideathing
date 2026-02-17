export const appModes = ["default", "theo"] as const;

export type AppMode = (typeof appModes)[number];

export const coreStatusValues = ["Concept", "To Stream", "Recorded"] as const;

export type CoreStatusValue = (typeof coreStatusValues)[number];
