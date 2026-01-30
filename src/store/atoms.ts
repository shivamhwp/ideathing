import { atomWithStorage } from "jotai/utils";

export interface IdeaDraft {
  title: string;
  description: string;
  thumbnailUrl: string;
  resources: string[];
  priority: "low" | "medium" | "high" | "";
  sponsored: boolean;
}

const defaultDraft: IdeaDraft = {
  title: "",
  description: "",
  thumbnailUrl: "",
  resources: [""],
  priority: "",
  sponsored: false,
};

export const ideaDraftAtom = atomWithStorage<IdeaDraft>("ideate-draft", defaultDraft);
