import type { Id } from "convex/_generated/dataModel";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export type OwnerType =
	| "Theo"
	| "Phase"
	| "Mir"
	| "flip"
	| "melkey"
	| "gabriel"
	| "ben"
	| "shivam"
	| "";
export type ChannelType =
	| "C:Main"
	| "C:Rants"
	| "C:Throwaways"
	| "C:Other"
	| "C:Main(SHORT)"
	| "";
export type LabelType =
	| "Requires Planning"
	| "Priority"
	| "Mid Priority"
	| "Strict deadline"
	| "Sponsored"
	| "High Effort"
	| "Worth it?"
	| "Evergreen"
	| "Database Week"
	| "";
export type StatusType =
	| "To Record(Off stream)"
	| "To Stream"
	| "Recorded"
	| "Editing"
	| "Done Editing"
	| "NEEDS THUMBNAIL"
	| "Ready To Publish"
	| "Scheduled"
	| "Published"
	| "Concept"
	| "Commited"
	| "dead"
	| "Shorts"
	| "2nd & 3rd Channel"
	| "Needs sponsor spot"
	| "Theo's Problem"
	| "archived"
	| "";

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
	adReadTracker: "planned" | "in da edit" | "done" | "";
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
	owner?: Exclude<OwnerType, ""> | null;
	channel?: Exclude<ChannelType, ""> | null;
	potential?: number | null;
	label?: Exclude<LabelType, ""> | null;
	status?: Exclude<StatusType, ""> | null;
	adReadTracker?: "planned" | "in da edit" | "done" | null;
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

export const newIdeaDraftAtom = atomWithStorage<IdeaDraft>(
	"ideathing-draft",
	defaultIdeaDraft,
);

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
export const newIdeaDescriptionAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"description",
);
export const newIdeaNotesAtom = createDraftFieldAtom(newIdeaDraftAtom, "notes");
export const newIdeaThumbnailAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"thumbnail",
);
export const newIdeaThumbnailReadyAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"thumbnailReady",
);
export const newIdeaResourcesAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"resources",
);

export const newIdeaVodRecordingDateAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"vodRecordingDate",
);
export const newIdeaReleaseDateAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"releaseDate",
);
export const newIdeaOwnerAtom = createDraftFieldAtom(newIdeaDraftAtom, "owner");
export const newIdeaChannelAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"channel",
);
export const newIdeaPotentialAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"potential",
);
export const newIdeaLabelAtom = createDraftFieldAtom(newIdeaDraftAtom, "label");
export const newIdeaStatusAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"status",
);
export const newIdeaAdReadTrackerAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"adReadTracker",
);
export const newIdeaUnsponsoredAtom = createDraftFieldAtom(
	newIdeaDraftAtom,
	"unsponsored",
);

export const editIdeaIdFieldAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"ideaId",
);
export const editIdeaTitleAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"title",
);
export const editIdeaDescriptionAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"description",
);
export const editIdeaNotesAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"notes",
);
export const editIdeaThumbnailAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"thumbnail",
);
export const editIdeaThumbnailReadyAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"thumbnailReady",
);
export const editIdeaResourcesAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"resources",
);

export const editIdeaVodRecordingDateAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"vodRecordingDate",
);
export const editIdeaReleaseDateAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"releaseDate",
);
export const editIdeaOwnerAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"owner",
);
export const editIdeaChannelAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"channel",
);
export const editIdeaPotentialAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"potential",
);
export const editIdeaLabelAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"label",
);
export const editIdeaStatusAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"status",
);
export const editIdeaAdReadTrackerAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"adReadTracker",
);
export const editIdeaUnsponsoredAtom = createDraftFieldAtom(
	editIdeaDraftAtom,
	"unsponsored",
);

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
	owner: idea.owner ?? "",
	channel: idea.channel ?? "",
	potential: typeof idea.potential === "number" ? idea.potential : "",
	label: idea.label ?? "",
	status: idea.status ?? "",
	adReadTracker: idea.adReadTracker ?? "",
	unsponsored: idea.unsponsored ?? true,
});
