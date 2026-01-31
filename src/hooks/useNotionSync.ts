import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useRef } from "react";

interface IdeaWithNotion {
  notionPageId?: string;
}

export function useNotionSync(ideas: IdeaWithNotion[] | undefined) {
  const syncStatusesFromNotion = useAction(api.notion.syncStatusesFromNotion);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
    if (hasSyncedRef.current || !ideas || ideas.length === 0) {
      return;
    }

    if (!ideas.some((idea) => idea.notionPageId)) {
      hasSyncedRef.current = true;
      return;
    }

    hasSyncedRef.current = true;
    void syncStatusesFromNotion();
  }, [ideas, syncStatusesFromNotion]);
}
