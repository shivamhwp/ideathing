import { convexQuery } from "@convex-dev/react-query";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAtom } from "jotai";
import { AppCommandCenter } from "@/components/AppCommandCenter";
import { EditIdeaPanel } from "@/components/EditIdeaPanel";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TheoIdeaQueue } from "@/components/TheoIdeaQueue";
import { TopNav } from "@/components/TopNav";
import { useTheoMode } from "@/hooks/useTheoMode";
import { editIdeaIdAtom, editIdeaOpenAtom } from "@/store/atoms";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const boardIdeasQuery = useQuery({
    ...convexQuery(api.ideas.queries.list, {}),
    enabled: !isTheoMode && isEditOpen,
  });
  const theoIdeasQuery = useQuery({
    ...convexQuery(api.ideas.queries.listTheoQueue, {}),
    enabled: isTheoMode && isEditOpen,
  });
  const currentIdeas = isTheoMode ? (theoIdeasQuery.data ?? []) : (boardIdeasQuery.data ?? []);
  const activeIdea = editIdeaId
    ? (currentIdeas.find((idea) => idea._id === editIdeaId) ?? null)
    : null;
  const boardView = isTheoMode ? <TheoIdeaQueue /> : <KanbanBoard />;

  if (isCheckingMode) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col bg-background">
      <div className="px-4 py-4 flex h-full flex-col flex-1 min-h-0 gap-4">
        <AppCommandCenter />
        <TopNav />
        {isEditOpen ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
            <ResizablePanel defaultSize="68%" minSize="42%" className="min-w-0">
              <div className="flex h-full min-h-0 flex-col">{boardView}</div>
            </ResizablePanel>
            <ResizableHandle className="mx-2" />
            <ResizablePanel
              defaultSize="32%"
              minSize="24rem"
              maxSize="45%"
              className="min-w-[22rem]"
            >
              <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-border/50 bg-card/60">
                <EditIdeaPanel
                  key={editIdeaId ?? "edit-idea"}
                  idea={activeIdea}
                  open={isEditOpen}
                  onOpenChange={(open) => {
                    setIsEditOpen(open);
                    if (!open) {
                      setEditIdeaId(null);
                    }
                  }}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          boardView
        )}
      </div>
    </div>
  );
}
