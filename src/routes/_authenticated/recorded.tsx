import { convexQuery } from "@convex-dev/react-query";
import { CassetteTapeIcon, ShareNetworkIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useSetAtom } from "jotai";
import { useRef, useState } from "react";
import { VirtuosoGrid, type VirtuosoGridHandle } from "react-virtuoso";
import { EditIdeaPanel } from "@/components/EditIdeaPanel";
import { IdeaCard } from "@/components/IdeaCard";
import { ShareIdeasModal } from "@/components/ShareIdeasModal";
import {
  getAutoFitColumnCount,
  NON_THEO_IDEA_CARD_MIN_WIDTH_PX,
  THEO_QUEUE_GAP_PX,
} from "@/components/idea-grid";
import type { Idea } from "@/components/KanbanBoard";
import { TopNav } from "@/components/TopNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useTheoMode } from "@/hooks/useTheoMode";
import { createIdeaDraftFromIdea, editIdeaDraftAtom } from "@/store/atoms";

export const Route = createFileRoute("/_authenticated/recorded")({
  component: RecordedIdeasPage,
});

function RecordedIdeasPage() {
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedIdeaIds, setSelectedIdeaIds] = useState<Id<"ideas">[]>([]);
  const [focusedIdeaId, setFocusedIdeaId] = useState<Idea["_id"] | null>(null);
  const gridRef = useRef<VirtuosoGridHandle>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const setDraft = useSetAtom(editIdeaDraftAtom);
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const { data: recorded, isLoading } = useQuery({
    ...convexQuery(api.ideas.queries.listRecorded, {}),
    gcTime: 60 * 60 * 1000, // 1 hour
    staleTime: 61 * 60 * 1000, // 1 hour + 1 minute
  });
  const recordedIdeas = recorded ?? [];
  const isSelectionMode = selectedIdeaIds.length > 0;
  const selectedIdSet = new Set(selectedIdeaIds);
  const gridWidth = useElementWidth(gridContainerRef);
  const gridColumns = getAutoFitColumnCount(
    gridWidth,
    THEO_QUEUE_GAP_PX,
    NON_THEO_IDEA_CARD_MIN_WIDTH_PX,
  );

  const getIdeaDomId = (ideaId: Idea["_id"]) => `idea-card-${ideaId}`;

  const focusIdea = (ideaId: Idea["_id"] | null) => {
    setFocusedIdeaId(ideaId);
    if (!ideaId) return;
    const nextIndex = recordedIdeas.findIndex((idea) => idea._id === ideaId);
    if (nextIndex < 0) return;
    gridRef.current?.scrollToIndex({
      index: nextIndex,
      align: "start",
      behavior: "smooth",
    });
  };
  const canUseMotionHotkeys =
    !isCheckingMode && !isTheoMode && !isLoading && !editingIdea && !isSelectionMode;
  const moveFocus = (step: number) => {
    if (recordedIdeas.length === 0) return;
    const currentIndex = recordedIdeas.findIndex((idea) => idea._id === focusedIdeaId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(recordedIdeas.length - 1, baseIndex + step));
    focusIdea(recordedIdeas[nextIndex]?._id ?? null);
  };

  useHotkey(
    "J",
    () => {
      moveFocus(gridColumns);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );
  useHotkey(
    "K",
    () => {
      moveFocus(-gridColumns);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );
  useHotkey(
    "L",
    () => {
      moveFocus(1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );
  useHotkey(
    "H",
    () => {
      moveFocus(-1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "Escape",
    () => {
      focusIdea(null);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  useHotkey(
    "Enter",
    () => {
      if (!focusedIdeaId) return;
      const focusedIdea = recordedIdeas.find((idea) => idea._id === focusedIdeaId);
      if (!focusedIdea) return;
      focusIdea(focusedIdea._id);
      setDraft(createIdeaDraftFromIdea(focusedIdea));
      setEditingIdea(focusedIdea);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  const toggleSelectedIdea = (ideaId: Id<"ideas">) => {
    setSelectedIdeaIds((prev) =>
      prev.includes(ideaId)
        ? prev.filter((selectedId) => selectedId !== ideaId)
        : [...prev, ideaId],
    );
  };

  const clearSelection = () => {
    setSelectedIdeaIds([]);
    setShareModalOpen(false);
  };

  if (isCheckingMode) {
    return (
      <div className="h-dvh overflow-hidden bg-background">
        <div className="flex h-full items-center justify-center">
          <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
        </div>
      </div>
    );
  }

  if (isTheoMode) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !recorded) {
    return (
      <div className="h-dvh overflow-hidden bg-background">
        <div className="px-4 py-6 flex h-full flex-col flex-1 min-h-0 gap-4">
          <div className="h-[40vh] rounded-2xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }
  const recordedContent =
    recorded.length === 0 ? (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex flex-col items-center justify-center text-xl text-muted-foreground/25">
          <CassetteTapeIcon weight="duotone" className="mb-2 h-12 w-12" />
          No recorded ideas yet.
        </div>
      </div>
    ) : (
      <div ref={gridContainerRef} className="h-full min-h-0">
        <VirtuosoGrid
          ref={gridRef}
          style={{ height: "100%" }}
          data={recorded}
          computeItemKey={(_, idea) => idea._id}
          listClassName="flex flex-wrap content-start gap-4"
          itemClassName="flex min-w-[15rem] shrink-0 basis-[15rem]"
          increaseViewportBy={{ top: 500, bottom: 500 }}
          itemContent={(_, idea) => (
            <IdeaCard
              idea={idea}
              onClick={() => {
                focusIdea(idea._id);
                setDraft(createIdeaDraftFromIdea(idea));
                setEditingIdea(idea);
              }}
              selectionMode={isSelectionMode}
              selected={selectedIdSet.has(idea._id)}
              onToggleSelect={toggleSelectedIdea}
              isKeyboardFocused={focusedIdeaId === idea._id}
              domId={getIdeaDomId(idea._id)}
            />
          )}
        />
      </div>
    );

  return (
    <div className="h-dvh overflow-hidden bg-background">
      <div className="px-4 py-4 flex h-full flex-col flex-1 min-h-0 gap-4">
        <TopNav />
        <section className="flex-1 min-h-0 rounded-2xl border border-border/60 bg-card/40 p-4">
          {editingIdea ? (
            <ResizablePanelGroup orientation="horizontal" className="min-h-0 h-full">
              <ResizablePanel defaultSize="68%" minSize="42%" className="min-w-0">
                {recordedContent}
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                defaultSize="32%"
                minSize="26rem"
                maxSize="45%"
                className="min-w-[26rem]"
              >
                <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border/50 bg-background">
                  <EditIdeaPanel
                    key={editingIdea._id}
                    idea={editingIdea}
                    open={Boolean(editingIdea)}
                    onOpenChange={(open) => !open && setEditingIdea(null)}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            recordedContent
          )}
        </section>
        {isSelectionMode ? (
          <div className="fixed inset-x-4 bottom-4 z-40 animate-in fade-in duration-150 sm:inset-x-auto sm:bottom-8 sm:right-8">
            <div className="w-full rounded-3xl border border-border/70 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl sm:w-[280px]">
              <div className="flex items-center justify-between gap-2 pb-3 text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs">Selected</span>
                  <Badge
                    variant="secondary"
                    className="rounded-sm bg-secondary/40 text-xs text-secondary-foreground"
                  >
                    {selectedIdeaIds.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="cursor-pointer text-xs font-medium"
                >
                  Deselect all
                </Button>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setShareModalOpen(true)}
                  variant="secondary"
                  className="h-10 w-full justify-start gap-2 rounded-full bg-secondary/40 text-secondary-foreground hover:bg-secondary/60"
                >
                  <ShareNetworkIcon className="h-4 w-4" weight="duotone" />
                  Share ideas
                </Button>
                <Button
                  variant="secondary"
                  onClick={clearSelection}
                  className="h-10 w-full justify-start gap-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <TrashIcon className="h-4 w-4" weight="duotone" />
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        <ShareIdeasModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          selectedIdeaIds={selectedIdeaIds}
          onClearSelection={() => setSelectedIdeaIds([])}
        />
      </div>
    </div>
  );
}
