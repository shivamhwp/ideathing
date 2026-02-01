import { useOrganization } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import type { Idea } from "@/components/KanbanBoard";
import { createIdeaDraftFromIdea, editIdeaDraftAtom } from "@/store/atoms";

export const Route = createFileRoute("/_authenticated/recorded")({
  component: RecordedIdeasPage,
});

function RecordedIdeasPage() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const setDraft = useSetAtom(editIdeaDraftAtom);
  const { data: recorded, isLoading } = useQuery({
    ...convexQuery(api.ideas.listRecorded, { organizationId }),
    gcTime: 60 * 60 * 1000, // 1 hour
    staleTime: 61 * 60 * 1000, // 1 hour + 1 minute
  });

  if (isLoading || !recorded) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="h-[40vh] rounded-2xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Recorded Vids
              <span className="ml-2 font-normal text-muted-foreground">{recorded?.length}</span>
            </h1>
          </div>
          <Link className="text-sm text-muted-foreground hover:text-foreground" to="/">
            Back to board
          </Link>
        </div>

        {recorded?.length === 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">No recorded ideas yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recorded.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onClick={() => {
                  setDraft(createIdeaDraftFromIdea(idea));
                  setEditingIdea(idea);
                }}
                organizationId={organizationId}
              />
            ))}
          </div>
        )}
      </div>

      <EditIdeaModal
        key={editingIdea?._id ?? "edit-idea-recorded"}
        idea={editingIdea}
        open={!!editingIdea}
        onOpenChange={(open) => !open && setEditingIdea(null)}
        organizationId={organizationId}
      />
    </div>
  );
}
