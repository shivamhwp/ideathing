import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { KanbanColumn } from "./KanbanColumn";
import { IdeaCard } from "./IdeaCard";
import { AddIdeaModal } from "./AddIdeaModal";
import { Plus, Lightbulb, VideoCamera } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

export type Idea = {
  _id: Id<"ideas">;
  title: string;
  description?: string;
  thumbnail?: string;
  resources?: string[];
  column: "ideas" | "vidit";
  order: number;
};

export function KanbanBoard() {
  const ideas = useQuery(api.ideas.list);
  const moveIdea = useMutation(api.ideas.move);
  const [activeId, setActiveId] = useState<Id<"ideas"> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (ideas === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  const ideasColumn = ideas
    .filter((idea) => idea.column === "ideas")
    .sort((a, b) => a.order - b.order);
  const viditColumn = ideas
    .filter((idea) => idea.column === "vidit")
    .sort((a, b) => a.order - b.order);

  const activeIdea = activeId
    ? ideas.find((idea) => idea._id === activeId)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as Id<"ideas">);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdea = ideas.find((idea) => idea._id === active.id);
    if (!activeIdea) return;

    let newColumn: "ideas" | "vidit" = activeIdea.column;
    let newOrder = activeIdea.order;

    // Determine target column
    if (over.id === "ideas" || over.id === "vidit") {
      newColumn = over.id as "ideas" | "vidit";
      const columnItems = ideas.filter((i) => i.column === newColumn);
      newOrder = columnItems.length;
    } else {
      const overIdea = ideas.find((idea) => idea._id === over.id);
      if (overIdea) {
        newColumn = overIdea.column;
        newOrder = overIdea.order;
      }
    }

    if (activeIdea.column !== newColumn || activeIdea.order !== newOrder) {
      await moveIdea({
        id: activeIdea._id,
        column: newColumn,
        order: newOrder,
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-foreground">Your Ideas</h2>
        <Button onClick={() => setShowAddModal(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" weight="bold" />
          Add Idea
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid md:grid-cols-2 gap-4">
          <SortableContext
            items={ideasColumn.map((i) => i._id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id="ideas"
              title="Ideas"
              icon={<Lightbulb className="w-4 h-4" weight="fill" />}
              color="amber"
              items={ideasColumn}
            />
          </SortableContext>

          <SortableContext
            items={viditColumn.map((i) => i._id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id="vidit"
              title="Vid It"
              icon={<VideoCamera className="w-4 h-4" weight="fill" />}
              color="pink"
              items={viditColumn}
            />
          </SortableContext>
        </div>

        <DragOverlay>
          {activeIdea ? <IdeaCard idea={activeIdea} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <AddIdeaModal open={showAddModal} onOpenChange={setShowAddModal} />
    </div>
  );
}
