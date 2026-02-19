import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ClipboardTextIcon, ShareNetworkIcon, SpinnerIcon, TrashIcon } from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  addIdeaModalOpenAtom,
  commandMenuOpenAtom,
  createIdeaDraftFromIdea,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaOpenAtom,
  ideaSelectionModeAtom,
  openAddIdeaModalAtom,
} from "@/store/atoms";
import { AddIdeaModal } from "./AddIdeaModal";
import { EditIdeaModal } from "./EditIdeaModal";
import { KanbanColumn } from "./KanbanColumn";
import { ShareIdeasModal } from "./ShareIdeasModal";

export type Idea = Doc<"ideas">;

const getIdeaDomId = (ideaId: Id<"ideas">) => `idea-card-${ideaId}`;

export function KanbanBoard() {
  const { isLoaded, isSignedIn } = useUser();

  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
  const setEditDraft = useSetAtom(editIdeaDraftAtom);
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const [isAddModalOpen, setAddModalOpen] = useAtom(addIdeaModalOpenAtom);
  const [selectionMode, setSelectionMode] = useAtom(ideaSelectionModeAtom);
  const [activeId, setActiveId] = useState<Id<"ideas"> | null>(null);
  const [focusedIdeaId, setFocusedIdeaId] = useState<Id<"ideas"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Id<"ideas">[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const commandCenterOpen = useAtomValue(commandMenuOpenAtom);

  const { data: ideas, isLoading: isIdeasLoading } = useQuery(
    convexQuery(api.ideas.queries.list, {}),
  );
  const moveIdea = useMutation(api.ideas.mutations.move);
  const isAuthResolved = isLoaded && typeof isSignedIn === "boolean";
  const isAuthLoading = !isAuthResolved;
  const isInteractionLocked = isAuthResolved && isSignedIn === false;
  const ideasData = ideas ?? [];
  const visibleIdeas = ideasData.filter((idea) => idea.status !== "Recorded");
  const conceptColumn = visibleIdeas
    .filter((idea) => idea.column === "Concept")
    .sort((a, b) => a.order - b.order);
  const toStreamColumn = visibleIdeas
    .filter((idea) => idea.column === "To Stream")
    .sort((a, b) => a.order - b.order);
  const activeIdea = activeId ? ideasData.find((idea) => idea._id === activeId) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const canUseMotionHotkeys =
    !isAuthLoading &&
    !isIdeasLoading &&
    ideas !== undefined &&
    !isInteractionLocked &&
    !selectionMode &&
    !isAddModalOpen &&
    !isEditOpen &&
    !commandCenterOpen;

  const focusIdea = (ideaId: Id<"ideas"> | null) => {
    setFocusedIdeaId(ideaId);
    if (!ideaId) return;
    requestAnimationFrame(() => {
      document.getElementById(getIdeaDomId(ideaId))?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    });
  };

  const resolveCurrentPosition = () => {
    const firstColumnIdea = conceptColumn[0]?._id ?? toStreamColumn[0]?._id ?? null;
    const currentId = focusedIdeaId ?? firstColumnIdea;
    if (!currentId) return null;

    const conceptIndex = conceptColumn.findIndex((idea) => idea._id === currentId);
    if (conceptIndex >= 0) return { column: "concept" as const, index: conceptIndex };

    const toStreamIndex = toStreamColumn.findIndex((idea) => idea._id === currentId);
    if (toStreamIndex >= 0) return { column: "to-stream" as const, index: toStreamIndex };

    if (conceptColumn.length > 0) return { column: "concept" as const, index: 0 };
    if (toStreamColumn.length > 0) return { column: "to-stream" as const, index: 0 };
    return null;
  };

  const moveVertical = (direction: 1 | -1) => {
    const position = resolveCurrentPosition();
    if (!position) return;

    const columnIdeas = position.column === "concept" ? conceptColumn : toStreamColumn;
    if (columnIdeas.length === 0) return;

    const targetIndex = Math.max(0, Math.min(columnIdeas.length - 1, position.index + direction));
    focusIdea(columnIdeas[targetIndex]?._id ?? null);
  };

  const moveHorizontal = (direction: 1 | -1) => {
    const position = resolveCurrentPosition();
    if (!position) return;

    const isMovingRight = direction === 1;
    const targetColumn = isMovingRight ? "to-stream" : "concept";
    const targetIdeas = targetColumn === "concept" ? conceptColumn : toStreamColumn;

    if (position.column === targetColumn || targetIdeas.length === 0) return;

    const targetIndex = Math.min(position.index, targetIdeas.length - 1);
    focusIdea(targetIdeas[targetIndex]?._id ?? null);
  };

  useHotkey(
    "J",
    () => {
      moveVertical(1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "K",
    () => {
      moveVertical(-1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "L",
    () => {
      moveHorizontal(1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "H",
    () => {
      moveHorizontal(-1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "Enter",
    () => {
      if (!focusedIdeaId) return;
      const focusedIdea = ideasData.find((idea) => idea._id === focusedIdeaId);
      if (!focusedIdea) return;
      handleEditIdea(focusedIdea);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  if (isAuthLoading || isIdeasLoading || ideas === undefined) {
    return (
      <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const handleAddIdea = () => {
    if (isInteractionLocked) return;
    openAddIdeaModal();
  };

  const handleEditIdea = (idea: Idea) => {
    if (isInteractionLocked) return;
    focusIdea(idea._id);
    setEditDraft(createIdeaDraftFromIdea(idea));
    setEditIdeaId(idea._id);
    setIsEditOpen(true);
  };

  const toggleSelected = (ideaId: Id<"ideas">) => {
    setSelectedIds((prev) => {
      if (prev.includes(ideaId)) {
        return prev.filter((id) => id !== ideaId);
      }
      return [...prev, ideaId];
    });
  };

  const handleSelectIdea = (ideaId: Id<"ideas">) => {
    if (isInteractionLocked) return;
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([ideaId]);
      return;
    }
    toggleSelected(ideaId);
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShareModalOpen(false);
  };

  const handleBoardPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-idea-id]")) return;
    focusIdea(null);
  };

  function handleDragStart(event: DragStartEvent) {
    if (isInteractionLocked) return;
    setActiveId(event.active.id as Id<"ideas">);
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (isInteractionLocked) {
      setActiveId(null);
      return;
    }

    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeIdea = ideasData.find((idea) => idea._id === active.id);
    if (!activeIdea) {
      setActiveId(null);
      return;
    }

    let newColumn: "Concept" | "To Stream" =
      activeIdea.column === "To Stream" ? "To Stream" : "Concept";
    let newOrder = activeIdea.order;

    if (over.id === "concept" || over.id === "to-stream") {
      newColumn = over.id === "to-stream" ? "To Stream" : "Concept";
      const columnItems = newColumn === "Concept" ? conceptColumn : toStreamColumn;
      newOrder = columnItems.length;
    } else {
      const overIdea = ideasData.find((idea) => idea._id === over.id);
      if (overIdea) {
        newColumn = overIdea.column === "To Stream" ? "To Stream" : "Concept";
        newOrder = overIdea.order;
      }
    }

    const activeColumn = activeIdea.column === "To Stream" ? "To Stream" : "Concept";
    if (activeColumn !== newColumn || activeIdea.order !== newOrder) {
      await moveIdea({
        id: activeIdea._id,
        column: newColumn,
        order: newOrder,
        status: newColumn,
      });
    }

    setTimeout(() => setActiveId(null), 250);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  const selectedIdSet = new Set(selectedIds);

  return (
    <div className="flex h-full flex-col flex-1 min-h-0 gap-4 select-none">
      {/* Kanban Columns */}
      <div className="relative h-full flex-1 min-h-0 ">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div
            className="grid h-full min-h-0 flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] grid-flow-col auto-cols-[minmax(20rem,92%)] grid-rows-[1fr] items-stretch gap-3 overflow-x-auto pb-1 snap-x snap-mandatory md:grid-flow-row md:auto-cols-auto md:grid-cols-2 md:gap-4 md:overflow-x-visible md:pb-0"
            onPointerDown={handleBoardPointerDown}
          >
            <SortableContext
              items={conceptColumn.map((idea) => idea._id)}
              strategy={rectSortingStrategy}
            >
              <KanbanColumn
                id="concept"
                title="Concept"
                color="concept"
                items={conceptColumn}
                onAddClick={handleAddIdea}
                onItemClick={handleEditIdea}
                interactive={!isInteractionLocked}
                selectionMode={selectionMode}
                selectedIds={selectedIdSet}
                onToggleSelect={handleSelectIdea}
                focusedIdeaId={focusedIdeaId}
                getIdeaDomId={getIdeaDomId}
              />
            </SortableContext>

            <SortableContext
              items={toStreamColumn.map((idea) => idea._id)}
              strategy={rectSortingStrategy}
            >
              <KanbanColumn
                id="to-stream"
                title="To Stream"
                color="to-stream"
                items={toStreamColumn}
                onItemClick={handleEditIdea}
                interactive={!isInteractionLocked}
                selectionMode={selectionMode}
                selectedIds={selectedIdSet}
                onToggleSelect={handleSelectIdea}
                focusedIdeaId={focusedIdeaId}
                getIdeaDomId={getIdeaDomId}
              />
            </SortableContext>
          </div>

          <DragOverlay
            dropAnimation={{
              duration: 250,
              easing: "cubic-bezier(0.25, 1, 0.5, 1)",
            }}
          >
            {activeIdea ? (
              <div className="w-48 rotate-2 scale-105 shadow-2xl opacity-95 pointer-events-none">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-2 ring-2 ring-primary/30">
                  {activeIdea.draftThumbnail && (
                    <img
                      src={activeIdea.draftThumbnail}
                      alt={activeIdea.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <h3 className="text-sm font-medium text-foreground line-clamp-2 px-0.5">
                  {activeIdea.title}
                </h3>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {isInteractionLocked && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl border border-border/70 bg-background/75 backdrop-blur-sm">
            <div className="mx-6 flex max-w-sm flex-col items-center gap-3 rounded-xl  backdrop-blur-lg  px-5 py-6 text-center">
              <h3 className="text-xl font-medium text-foreground">Sign in to use ideathing</h3>
            </div>
          </div>
        )}
      </div>

      <AddIdeaModal open={!isInteractionLocked && isAddModalOpen} onOpenChange={setAddModalOpen} />
      <EditIdeaModal
        key={editIdeaId ?? "edit-idea"}
        idea={ideasData.find((idea) => idea._id === editIdeaId) ?? null}
        open={!isInteractionLocked && isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditIdeaId(null);
          }
        }}
      />

      {!isInteractionLocked && selectionMode && selectedIds.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 animate-in fade-in duration-150 sm:inset-x-auto sm:bottom-8 sm:right-8">
          <div className="w-full rounded-3xl border border-border/70 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl sm:w-[280px]">
            <div className="flex flex-col items-start gap-2 px-1 pb-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <span>ideas selected</span>
                <span className="px-3 text-xs">{selectedIds.length}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelSelection}
                className="text-xs font-medium transition hover:text-foreground cursor-pointer"
              >
                Deselect all
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setShareModalOpen(true)}
                variant="secondary"
                className="h-10 w-full justify-start gap-2 rounded-full cursor-pointer bg-secondary/40 text-secondary-foreground hover:bg-secondary/60"
              >
                <ShareNetworkIcon className="h-4 w-4" weight="duotone" />
                Share ideas
              </Button>
              <Button
                variant="ghost"
                onClick={clearSelection}
                className="h-10 w-full justify-start border-none bg-muted/60 hover:bg-muted cursor-pointer gap-2 rounded-full text-foreground "
              >
                <ClipboardTextIcon className="h-4 w-4" weight="duotone" />
                Clear selection
              </Button>
              <Button
                variant="secondary"
                onClick={cancelSelection}
                className="h-10 w-full justify-start gap-2 cursor-pointer rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <TrashIcon className="h-4 w-4" weight="duotone" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <ShareIdeasModal
        open={!isInteractionLocked && shareModalOpen}
        onOpenChange={setShareModalOpen}
        selectedIdeaIds={selectedIds}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
