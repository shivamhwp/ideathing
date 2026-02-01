import { useEffect, useRef } from "react";
import { toast } from "sonner";

type IdeaWithSync = {
	_id: string;
	title: string;
	syncedAt?: number;
};

export function useNotionSyncToast(ideas: IdeaWithSync[] | undefined) {
	const prevSyncedAtMap = useRef<Map<string, number>>(new Map());

	useEffect(() => {
		if (!ideas) return;

		const currentMap = new Map<string, number>();
		const syncedIdeas: IdeaWithSync[] = [];

		for (const idea of ideas) {
			if (idea.syncedAt) {
				currentMap.set(idea._id, idea.syncedAt);

				const prevSyncedAt = prevSyncedAtMap.current.get(idea._id);
				// Only show toast if this is an update (not initial load)
				if (prevSyncedAt !== undefined && prevSyncedAt !== idea.syncedAt) {
					syncedIdeas.push(idea);
				}
			}
		}

		// Show toast for synced ideas
		if (syncedIdeas.length === 1) {
			toast.success(`"${syncedIdeas[0].title}" synced from Notion`, {
				duration: 3000,
			});
		} else if (syncedIdeas.length > 1) {
			toast.success(`${syncedIdeas.length} ideas synced from Notion`, {
				duration: 3000,
			});
		}

		prevSyncedAtMap.current = currentMap;
	}, [ideas]);
}
