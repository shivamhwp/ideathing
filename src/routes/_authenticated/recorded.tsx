import { convexQuery } from "@convex-dev/react-query";
import { CassetteTapeIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import type { Idea } from "@/components/KanbanBoard";
import { TopNav } from "@/components/TopNav";
import { createIdeaDraftFromIdea, editIdeaDraftAtom } from "@/store/atoms";

export const Route = createFileRoute("/_authenticated/recorded")({
  component: RecordedIdeasPage,
});

function RecordedIdeasPage() {
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const setDraft = useSetAtom(editIdeaDraftAtom);
  const { data: recorded, isLoading } = useQuery({
    ...convexQuery(api.ideas.queries.listRecorded, {}),
    gcTime: 60 * 60 * 1000, // 1 hour
    staleTime: 61 * 60 * 1000, // 1 hour + 1 minute
  });

  if (isLoading || !recorded) {
    return (
      <div className="min-h-dvh flex flex-col bg-background">
        <div className="px-4 py-6 flex flex-col flex-1 min-h-0 gap-4">
          <div className="h-[40vh] rounded-2xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="px-4 py-4 flex flex-col flex-1 min-h-0 gap-4">
        <TopNav />
        <section className="flex-1 min-h-0 rounded-2xl border border-border/60 bg-card/40 p-4">
          {recorded?.length === 0 ? (
            <div className="h-full p-6 items-center justify-center">
              <div className=" text-muted-foreground/25 flex items-center justify-center h-full w-full flex-col text-xl">
                <CassetteTapeIcon weight="duotone" className="w-16 h-16" />
                No recorded ideas yet.
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {recorded.map((idea) => (
                  <IdeaCard
                    key={idea._id}
                    idea={idea}
                    onClick={() => {
                      setDraft(createIdeaDraftFromIdea(idea));
                      setEditingIdea(idea);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <EditIdeaModal
        key={editingIdea?._id ?? "edit-idea-recorded"}
        idea={editingIdea}
        open={!!editingIdea}
        onOpenChange={(open) => !open && setEditingIdea(null)}
      />
    </div>
  );
}
