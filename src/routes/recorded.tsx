import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useQuery } from "convex/react";
import { useState } from "react";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import type { Idea } from "@/components/KanbanBoard";
import { Button } from "@/components/ui/button";
import { useNotionSync } from "@/hooks/useNotionSync";

export const Route = createFileRoute("/recorded")({
	component: RecordedIdeasPage,
});

function RecordedIdeasPage() {
  const ideas = useQuery(api.ideas.list);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

  useNotionSync(ideas);

  if (ideas === undefined) {
    return (
      <div className="min-h-screen bg-background px-4 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="h-[40vh] rounded-2xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  const recorded = ideas.filter((idea) => idea.status === "Recorded");

	return (
		<div className="min-h-screen bg-background px-4 py-6">
			<div className="max-w-6xl mx-auto space-y-5">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-semibold text-foreground">
							Recorded Vids
							<span className="ml-2 font-normal text-muted-foreground">
								{recorded.length}
							</span>
						</h1>
					</div>
					<Button asChild variant="outline" size="sm">
						<Link to="/">Back to board</Link>
					</Button>
				</div>

				{recorded.length === 0 ? (
					<div className="rounded-2xl border border-border/60 bg-card/40 p-10 text-center">
						<p className="text-sm text-muted-foreground">
							No recorded ideas yet.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
						{recorded.map((idea) => (
							<IdeaCard
								key={idea._id}
								idea={idea}
								onClick={() => setEditingIdea(idea)}
							/>
						))}
					</div>
				)}
			</div>

			<EditIdeaModal
				idea={editingIdea}
				open={!!editingIdea}
				onOpenChange={(open) => !open && setEditingIdea(null)}
			/>
		</div>
	);
}
