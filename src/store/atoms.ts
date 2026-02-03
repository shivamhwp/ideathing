import type { Id } from "convex/_generated/dataModel";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import {
  adReadTrackerValues,
  channelValues,
  labelValues,
  ownerValues,
  statusValues,
  type AdReadTrackerValue,
  type ChannelValue,
  type LabelValue,
  type OwnerValue,
  type StatusValue,
} from "../../shared/idea-values";

export type OwnerType = OwnerValue | "";
export type ChannelType = ChannelValue | "";
export type LabelType = LabelValue | "";
export type StatusType = StatusValue | "";

export interface IdeaDraft {
  ideaId?: Id<"ideas"> | null;
  title: string;
  description: string;
  notes: string;
  thumbnail: string;
  thumbnailReady: boolean;
  resources: string[];

  vodRecordingDate: string;
  releaseDate: string;
  owner: OwnerType;
  channel: ChannelType;
  potential: number | "";
  label: LabelType;
  status: StatusType;
  adReadTracker: AdReadTrackerValue | "";
  unsponsored: boolean;
}

export type IdeaDraftSource = {
  _id: Id<"ideas">;
  title: string;
  description?: string | null;
  notes?: string | null;
  thumbnail?: string | null;
  thumbnailReady?: boolean;
  resources?: string[] | null;

  vodRecordingDate?: string | null;
  releaseDate?: string | null;
  owner?: string | null;
  channel?: string | null;
  potential?: number | null;
  label?: string | null;
  status?: string | null;
  adReadTracker?: string | null;
  unsponsored?: boolean | null;
};

export const defaultIdeaDraft: IdeaDraft = {
  ideaId: null,
  title: "",
  description: "",
  notes: "",
  thumbnail: "",
  thumbnailReady: false,
  resources: [""],

  vodRecordingDate: "",
  releaseDate: "",
  owner: "",
  channel: "",
  potential: "",
  label: "",
  status: "",
  adReadTracker: "",
  unsponsored: true,
};

export const streamModeAtom = atomWithStorage("streamMode", false);

export const newIdeaDraftAtom = atomWithStorage<IdeaDraft>("ideathing-draft", defaultIdeaDraft);

export const editIdeaDraftAtom = atom<IdeaDraft>(defaultIdeaDraft);

export const editIdeaIdAtom = atom<Id<"ideas"> | null>(null);
export const editIdeaOpenAtom = atom(false);
export const editIdeaIsEditingAtom = atom(false);

type DraftKey = keyof IdeaDraft;
const createDraftFieldAtom = <K extends DraftKey>(
  baseAtom: typeof newIdeaDraftAtom | typeof editIdeaDraftAtom,
  key: K,
) =>
  atom(
    (get) => get(baseAtom)[key],
    (get, set, value: IdeaDraft[K]) => {
      const prev = get(baseAtom);
      if (prev[key] === value) return;
      set(baseAtom, { ...prev, [key]: value });
    },
  );

export const newIdeaTitleAtom = createDraftFieldAtom(newIdeaDraftAtom, "title");
export const newIdeaDescriptionAtom = createDraftFieldAtom(newIdeaDraftAtom, "description");
export const newIdeaNotesAtom = createDraftFieldAtom(newIdeaDraftAtom, "notes");
export const newIdeaThumbnailAtom = createDraftFieldAtom(newIdeaDraftAtom, "thumbnail");
export const newIdeaThumbnailReadyAtom = createDraftFieldAtom(newIdeaDraftAtom, "thumbnailReady");
export const newIdeaResourcesAtom = createDraftFieldAtom(newIdeaDraftAtom, "resources");

export const newIdeaVodRecordingDateAtom = createDraftFieldAtom(
  newIdeaDraftAtom,
  "vodRecordingDate",
);
export const newIdeaReleaseDateAtom = createDraftFieldAtom(newIdeaDraftAtom, "releaseDate");
export const newIdeaOwnerAtom = createDraftFieldAtom(newIdeaDraftAtom, "owner");
export const newIdeaChannelAtom = createDraftFieldAtom(newIdeaDraftAtom, "channel");
export const newIdeaPotentialAtom = createDraftFieldAtom(newIdeaDraftAtom, "potential");
export const newIdeaLabelAtom = createDraftFieldAtom(newIdeaDraftAtom, "label");
export const newIdeaStatusAtom = createDraftFieldAtom(newIdeaDraftAtom, "status");
export const newIdeaAdReadTrackerAtom = createDraftFieldAtom(newIdeaDraftAtom, "adReadTracker");
export const newIdeaUnsponsoredAtom = createDraftFieldAtom(newIdeaDraftAtom, "unsponsored");

export const editIdeaIdFieldAtom = createDraftFieldAtom(editIdeaDraftAtom, "ideaId");
export const editIdeaTitleAtom = createDraftFieldAtom(editIdeaDraftAtom, "title");
export const editIdeaDescriptionAtom = createDraftFieldAtom(editIdeaDraftAtom, "description");
export const editIdeaNotesAtom = createDraftFieldAtom(editIdeaDraftAtom, "notes");
export const editIdeaThumbnailAtom = createDraftFieldAtom(editIdeaDraftAtom, "thumbnail");
export const editIdeaThumbnailReadyAtom = createDraftFieldAtom(editIdeaDraftAtom, "thumbnailReady");
export const editIdeaResourcesAtom = createDraftFieldAtom(editIdeaDraftAtom, "resources");

export const editIdeaVodRecordingDateAtom = createDraftFieldAtom(
  editIdeaDraftAtom,
  "vodRecordingDate",
);
export const editIdeaReleaseDateAtom = createDraftFieldAtom(editIdeaDraftAtom, "releaseDate");
export const editIdeaOwnerAtom = createDraftFieldAtom(editIdeaDraftAtom, "owner");
export const editIdeaChannelAtom = createDraftFieldAtom(editIdeaDraftAtom, "channel");
export const editIdeaPotentialAtom = createDraftFieldAtom(editIdeaDraftAtom, "potential");
export const editIdeaLabelAtom = createDraftFieldAtom(editIdeaDraftAtom, "label");
export const editIdeaStatusAtom = createDraftFieldAtom(editIdeaDraftAtom, "status");
export const editIdeaAdReadTrackerAtom = createDraftFieldAtom(editIdeaDraftAtom, "adReadTracker");
export const editIdeaUnsponsoredAtom = createDraftFieldAtom(editIdeaDraftAtom, "unsponsored");

export const createIdeaDraftFromIdea = (idea: IdeaDraftSource): IdeaDraft => ({
  ideaId: idea._id,
  title: idea.title ?? "",
  description: idea.description ?? "",
  notes: idea.notes ?? "",
  thumbnail: idea.thumbnail ?? "",
  thumbnailReady: idea.thumbnailReady ?? false,
  resources: idea.resources?.length ? idea.resources : [""],

  vodRecordingDate: idea.vodRecordingDate ?? "",
  releaseDate: idea.releaseDate ?? "",
  owner: normalizeValue(idea.owner, ownerValues),
  channel: normalizeValue(idea.channel, channelValues),
  potential: typeof idea.potential === "number" ? idea.potential : "",
  label: normalizeValue(idea.label, labelValues),
  status: normalizeValue(idea.status, statusValues),
  adReadTracker: normalizeValue(idea.adReadTracker, adReadTrackerValues),
  unsponsored: idea.unsponsored ?? true,
});

const normalizeValue = <T extends readonly string[]>(
  value: string | null | undefined,
  values: T,
): T[number] | "" => {
  if (!value) return "";
  return values.includes(value as T[number]) ? (value as T[number]) : "";
};
