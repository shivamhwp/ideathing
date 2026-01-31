import type { Id } from "convex/_generated/dataModel";
import { atomWithStorage } from "jotai/utils";

export interface IdeaDraft {
	ideaId?: Id<"ideas"> | null;
	title: string;
	description: string;
	notes: string;
	thumbnail: string;
	thumbnailReady: boolean;
	resources: string[];
	recorded: boolean;
	vodRecordingDate: string;
	releaseDate: string;
	owner: "Theo" | "Phase" | "Ben" | "";
	channel: "main" | "theo rants" | "theo throwaways" | "";
	potential: number | "";
	label: "mid priority" | "low priority" | "high priority" | "";
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
	recorded?: boolean;
	vodRecordingDate?: string | null;
	releaseDate?: string | null;
	owner?: "Theo" | "Phase" | "Ben" | null;
	channel?: "main" | "theo rants" | "theo throwaways" | null;
	potential?: number | null;
	label?: "mid priority" | "low priority" | "high priority" | null;
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
	recorded: false,
	vodRecordingDate: "",
	releaseDate: "",
	owner: "",
	channel: "",
	potential: "",
	label: "",
	adReadTracker: "",
	unsponsored: true,
};

export const ideaDraftAtom = atomWithStorage<IdeaDraft>(
	"ideathing-draft",
	defaultIdeaDraft,
);

export const createIdeaDraftFromIdea = (idea: IdeaDraftSource): IdeaDraft => ({
	ideaId: idea._id,
	title: idea.title ?? "",
	description: idea.description ?? "",
	notes: idea.notes ?? "",
	thumbnail: idea.thumbnail ?? "",
	thumbnailReady: idea.thumbnailReady ?? false,
	resources: idea.resources?.length ? idea.resources : [""],
	recorded: idea.recorded ?? false,
	vodRecordingDate: idea.vodRecordingDate ?? "",
	releaseDate: idea.releaseDate ?? "",
	owner: idea.owner ?? "",
	channel: idea.channel ?? "",
	potential: typeof idea.potential === "number" ? idea.potential : "",
	label: idea.label ?? "",
	adReadTracker: idea.adReadTracker ?? "",
	unsponsored: idea.unsponsored ?? true,
});
