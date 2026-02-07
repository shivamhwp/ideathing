import type { Id } from "convex/_generated/dataModel";
import type { WritableAtom } from "jotai";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  type ChannelValue,
  channelValues,
  type LabelValue,
  labelValues,
  type OwnerValue,
  ownerValues,
  type StatusValue,
  statusValues,
} from "../../shared/idea-values";

export type OwnerType = OwnerValue | "";
export type ChannelType = ChannelValue | "";
export type LabelType = LabelValue[];
export type StatusType = StatusValue | "";

export interface IdeaDraft {
  ideaId?: Id<"ideas"> | null;
  title: string;
  description: string;
  notes: string;
  draftThumbnail: string;
  thumbnailReady: boolean;
  resources: string[];

  vodRecordingDate: string;
  releaseDate: string;
  owner: OwnerType;
  channel: ChannelType;
  potential: number | "";
  label: LabelType;
  status: StatusType;
  adReadTracker: string;
  unsponsored: boolean;
}

export type IdeaDraftSource = {
  _id: Id<"ideas">;
  title: string;
  description?: string;
  notes?: string;
  draftThumbnail?: string | null;
  thumbnailReady?: boolean;
  resources?: string[];

  vodRecordingDate?: string;
  releaseDate?: string;
  owner?: string;
  channel?: string;
  potential?: number;
  label?: string | string[];
  status?: string;
  adReadTracker?: string;
  unsponsored?: boolean;
};

export const defaultIdeaDraft: IdeaDraft = {
  ideaId: null,
  title: "",
  description: "",
  notes: "",
  draftThumbnail: "",
  thumbnailReady: false,
  resources: [""],

  vodRecordingDate: "",
  releaseDate: "",
  owner: "",
  channel: "",
  potential: "",
  label: [],
  status: "",
  adReadTracker: "",
  unsponsored: true,
};

export const streamModeAtom = atomWithStorage("streamMode", false);
export const ideaSelectionModeAtom = atom(false);

export const newIdeaDraftAtom = atomWithStorage<IdeaDraft>("ideathing-draft", defaultIdeaDraft);

export const editIdeaDraftAtom = atom<IdeaDraft>(defaultIdeaDraft);

export const editIdeaIdAtom = atom<Id<"ideas"> | null>(null);
export const editIdeaOpenAtom = atom(false);
export const editIdeaIsEditingAtom = atom(false);

type FieldAtoms = {
  [K in keyof IdeaDraft]-?: WritableAtom<IdeaDraft[K], [IdeaDraft[K]], void>;
};

const buildFieldAtoms = (
  baseAtom: typeof newIdeaDraftAtom | typeof editIdeaDraftAtom,
): FieldAtoms => {
  const keys = Object.keys(defaultIdeaDraft) as (keyof IdeaDraft)[];
  const result = {} as Record<string, unknown>;
  for (const key of keys) {
    result[key] = atom(
      (get) => get(baseAtom)[key] ?? defaultIdeaDraft[key],
      (get, set, value: IdeaDraft[typeof key]) => {
        const prev = get(baseAtom);
        if (prev[key] === value) return;
        set(baseAtom, { ...prev, [key]: value });
      },
    );
  }
  return result as FieldAtoms;
};

export const newIdeaFields = buildFieldAtoms(newIdeaDraftAtom);
export const editIdeaFields = buildFieldAtoms(editIdeaDraftAtom);

export const createIdeaDraftFromIdea = (idea: IdeaDraftSource): IdeaDraft => ({
  ideaId: idea._id,
  title: idea.title ?? "",
  description: idea.description ?? "",
  notes: idea.notes ?? "",
  draftThumbnail: idea.draftThumbnail ?? "",
  thumbnailReady: idea.thumbnailReady ?? false,
  resources: idea.resources?.length ? idea.resources : [""],

  vodRecordingDate: idea.vodRecordingDate ?? "",
  releaseDate: idea.releaseDate ?? "",
  owner: normalizeValue(idea.owner, ownerValues),
  channel: normalizeValue(idea.channel, channelValues),
  potential: typeof idea.potential === "number" ? idea.potential : "",
  label: normalizeLabelList(idea.label),
  status: normalizeValue(idea.status, statusValues),
  adReadTracker: idea.adReadTracker ?? "",
  unsponsored: idea.unsponsored ?? true,
});

const normalizeValue = <T extends readonly string[]>(
  value: string | null | undefined,
  values: T,
): T[number] | "" => {
  if (!value) return "";
  return values.includes(value as T[number]) ? (value as T[number]) : "";
};

const normalizeLabelList = (value: string | string[] | null | undefined) => {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const map = new Map(labelValues.map((label) => [label.toLowerCase(), label]));
  const normalized = list
    .map((entry) => map.get(entry.toLowerCase()))
    .filter(Boolean) as LabelValue[];
  return labelValues.filter((label) => normalized.includes(label));
};
