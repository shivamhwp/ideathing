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
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useAtom, useSetAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNotionSyncToast } from "@/hooks/useNotionSyncToast";
import {
  addIdeaModalOpenAtom,
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

export function KanbanBoard() {
  const { isSignedIn } = useUser();

  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
  const setEditDraft = useSetAtom(editIdeaDraftAtom);
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const [isAddModalOpen, setAddModalOpen] = useAtom(addIdeaModalOpenAtom);
  const [selectionMode, setSelectionMode] = useAtom(ideaSelectionModeAtom);
  const [activeId, setActiveId] = useState<Id<"ideas"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Id<"ideas">[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { data: ideas, isLoading: isIdeasLoading } = useQuery(
    convexQuery(api.ideas.queries.list, {}),
  );
  const { data: notionConnection } = useQuery(convexQuery(api.notion.queries.getConnection, {}));
  const isNotionConnected = !!notionConnection?.databaseId;
  const moveIdea = useMutation(api.ideas.mutations.move);

  useNotionSyncToast(ideas);

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

  if (isIdeasLoading || ideas === undefined) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const ideasData = ideas ?? [];
  const visibleIdeas = ideasData.filter((idea) => idea.status !== "Recorded");
  const conceptColumn = visibleIdeas
    .filter((idea) => idea.column === "Concept")
    .sort((a, b) => a.order - b.order);
  const toStreamColumn = visibleIdeas
    .filter((idea) => idea.column === "To Stream")
    .sort((a, b) => a.order - b.order);

  const activeIdea = activeId ? ideasData.find((idea) => idea._id === activeId) : null;

  const handleAddIdea = () => {
    openAddIdeaModal();
  };

  const handleEditIdea = (idea: Idea) => {
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

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as Id<"ideas">);
  }

  async function handleDragEnd(event: DragEndEvent) {
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

    if (newColumn === "To Stream" && (!isSignedIn || !isNotionConnected)) {
      if (isSignedIn && !isNotionConnected) {
        toast.error("Finish the Notion connection setup to move ideas here");
      }
      setActiveId(null);
      return;
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
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-2 grid-rows-[1fr] items-stretch gap-4 flex-1 min-h-0">
          <SortableContext items={conceptColumn.map((i) => i._id)} strategy={rectSortingStrategy}>
            <KanbanColumn
              id="concept"
              title="Concept"
              color="concept"
              items={conceptColumn}
              onAddClick={handleAddIdea}
              onItemClick={handleEditIdea}
              isSignedIn={isSignedIn}
              selectionMode={selectionMode}
              selectedIds={selectedIdSet}
              onToggleSelect={handleSelectIdea}
            />
          </SortableContext>

          <SortableContext items={toStreamColumn.map((i) => i._id)} strategy={rectSortingStrategy}>
            <KanbanColumn
              id="to-stream"
              title="To Stream"
              color="to-stream"
              items={toStreamColumn}
              onItemClick={handleEditIdea}
              isSignedIn={isSignedIn}
              isNotionConnected={isNotionConnected}
              selectionMode={selectionMode}
              selectedIds={selectedIdSet}
              onToggleSelect={handleSelectIdea}
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

      <AddIdeaModal open={isAddModalOpen} onOpenChange={setAddModalOpen} />
      <EditIdeaModal
        key={editIdeaId ?? "edit-idea"}
        idea={ideasData.find((idea) => idea._id === editIdeaId) ?? null}
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditIdeaId(null);
          }
        }}
      />

      {selectionMode && selectedIds.length > 0 && (
        <div className="fixed bottom-8 z-40 right-8 animate-in fade-in duration-150">
          <div className="w-[280px] rounded-3xl border border-border/70 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between px-1 pb-3 text-xs text-muted-foreground">
              <div className="flex items-center ">
                <span>ideas selected</span>
                <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px]">
                  {selectedIds.length}
                </span>
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
                className="h-10 w-full justify-start gap-2 rounded-full cursor-pointer bg-secondary/40 text-secondary-foreground shadow-inner hover:bg-secondary/60"
              >
                <ShareNetworkIcon className="h-4 w-4" weight="duotone" />
                Share ideas
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                className="h-10 w-full justify-start border-none cursor-pointer gap-2 rounded-full text-foreground shadow-inner hover:bg-muted/60"
              >
                <ClipboardTextIcon className="h-4 w-4" weight="duotone" />
                Clear selection
              </Button>
              <Button
                variant="secondary"
                onClick={cancelSelection}
                className="h-10 w-full justify-start gap-2 cursor-pointer rounded-full bg-destructive/10 text-destructive shadow-inner hover:bg-destructive/20"
              >
                <TrashIcon className="h-4 w-4" weight="duotone" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <ShareIdeasModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        selectedIdeaIds={selectedIds}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
