import { atomWithStorage } from "jotai/utils";

export interface IdeaDraft {
	title: string;
	description: string;
	notes: string;
	thumbnailUrl: string;
	thumbnailReady: boolean;
	resources: string[];
	status: "idea" | "To Stream" | "Recorded";
	vodRecordingDate: string;
	releaseDate: string;
	owner: "Theo" | "Phase" | "Ben" | "";
	channel: "main" | "theo rants" | "theo throwaways" | "";
	potential: number | "";
	label: "mid priority" | "low priority" | "high priority" | "";
	adReadTracker: "planned" | "in da edit" | "done" | "";
	unsponsored: boolean;
}

const defaultDraft: IdeaDraft = {
	title: "",
	description: "",
	notes: "",
	thumbnailUrl: "",
	thumbnailReady: false,
	resources: [""],
	status: "idea",
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
	defaultDraft,
);
