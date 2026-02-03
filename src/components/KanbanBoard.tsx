import { useUser } from "@clerk/tanstack-react-start";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SpinnerIcon } from "@phosphor-icons/react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useAtom, useSetAtom } from "jotai";
import { useState } from "react";
import { toast } from "sonner";
import { useNotionSyncToast } from "@/hooks/useNotionSyncToast";
import {
  createIdeaDraftFromIdea,
  defaultIdeaDraft,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaOpenAtom,
  newIdeaDraftAtom,
} from "@/store/atoms";
import { AddIdeaModal } from "./AddIdeaModal";
import { EditIdeaModal } from "./EditIdeaModal";
import { KanbanColumn } from "./KanbanColumn";

export type Idea = Doc<"ideas">;

export function KanbanBoard() {
  const { isSignedIn } = useUser();

  const setNewDraft = useSetAtom(newIdeaDraftAtom);
  const setEditDraft = useSetAtom(editIdeaDraftAtom);
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const [activeId, setActiveId] = useState<Id<"ideas"> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const { data: ideas, isLoading: isIdeasLoading } = useQuery(
    convexQuery(api.ideas.list, {}),
  );
  const { data: notionConnection } = useQuery(
    convexQuery(api.notion.getConnection, {}),
  );
  const isNotionConnected = !!notionConnection?.databaseId;
  const moveIdea = useMutation(api.ideas.move);

  // Show toast notifications when ideas are synced from Notion
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
    setNewDraft((prev) => (prev.ideaId ? defaultIdeaDraft : prev));
    setIsEditOpen(false);
    setEditIdeaId(null);
    setShowAddModal(true);
  };

  const handleEditIdea = (idea: Idea) => {
    setEditDraft(createIdeaDraftFromIdea(idea));
    setEditIdeaId(idea._id);
    setIsEditOpen(true);
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

    // Prevent moving to "To Stream" if not signed in or Notion not connected
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
        // Set status based on column
        status: newColumn,
      });
    }

    // Clear after drop animation completes (matches DragOverlay dropAnimation duration)
    setTimeout(() => setActiveId(null), 250);
  }

  function handleDragCancel() {
    setActiveId(null);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Kanban Columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          <SortableContext items={conceptColumn.map((i) => i._id)} strategy={rectSortingStrategy}>
            <KanbanColumn
              id="concept"
              title="Concept"
              color="concept"
              items={conceptColumn}
              onAddClick={handleAddIdea}
              onItemClick={handleEditIdea}
              isSignedIn={isSignedIn}
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
                {activeIdea.thumbnail && !activeIdea.thumbnail.startsWith("k") && (
                  <img
                    src={activeIdea.thumbnail}
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

      <AddIdeaModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
      />
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
    </div>
  );
}
