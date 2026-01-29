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
import { Plus, Lightbulb, Video } from "lucide-react";

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Your Ideas</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Idea
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid md:grid-cols-2 gap-6">
          <SortableContext
            items={ideasColumn.map((i) => i._id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id="ideas"
              title="Ideas"
              icon={<Lightbulb className="w-5 h-5" />}
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
              icon={<Video className="w-5 h-5" />}
              color="emerald"
              items={viditColumn}
            />
          </SortableContext>
        </div>

        <DragOverlay>
          {activeIdea ? <IdeaCard idea={activeIdea} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {showAddModal && <AddIdeaModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
