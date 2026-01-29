import {
  closestCorners,
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Lightbulb,
  Plus,
  VideoCamera,
  FunnelSimple,
  Rows,
  SquaresFour,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AddIdeaModal } from "./AddIdeaModal";
import { IdeaCard } from "./IdeaCard";
import { KanbanColumn } from "./KanbanColumn";

export type Idea = {
  _id: Id<"ideas">;
  title: string;
  description?: string;
  thumbnail?: string;
  resources?: string[];
  column: "ideas" | "vid-it";
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
    }),
  );

  if (ideas === undefined) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-primary/10 animate-pulse" />
            <div className="absolute inset-0 w-10 h-10 rounded-xl border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
          <span className="text-sm text-muted-foreground">Loading ideas...</span>
        </div>
      </div>
    );
  }

  const ideasColumn = ideas
    .filter((idea) => idea.column === "ideas")
    .sort((a, b) => a.order - b.order);
  const vidItColumn = ideas
    .filter((idea) => idea.column === "vid-it")
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

    let newColumn: "ideas" | "vid-it" = activeIdea.column;
    let newOrder = activeIdea.order;

    if (over.id === "ideas" || over.id === "vid-it") {
      newColumn = over.id as "ideas" | "vid-it";
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

  const totalIdeas = ideas.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="toolbar">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            All ideas
            <span className="text-sm font-normal text-muted-foreground">
              {totalIdeas}
            </span>
          </h2>

          <div className="toolbar-divider" />

          <div className="toolbar-group">
            <button className="toolbar-button">
              <FunnelSimple className="w-3.5 h-3.5" weight="bold" />
              Filter
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="toolbar-group bg-muted/30 rounded-lg p-0.5">
            <button className="toolbar-button toolbar-button-active">
              <Rows className="w-3.5 h-3.5" weight="bold" />
            </button>
            <button className="toolbar-button">
              <SquaresFour className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="add-idea-button"
          >
            <Plus className="w-4 h-4" weight="bold" />
            Add idea
          </button>
        </div>
      </div>

      {/* Kanban Columns */}
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
              color="ideas"
              items={ideasColumn}
              onAddClick={() => setShowAddModal(true)}
            />
          </SortableContext>

          <SortableContext
            items={vidItColumn.map((i) => i._id)}
            strategy={verticalListSortingStrategy}
          >
            <KanbanColumn
              id="vid-it"
              title="Vid It"
              icon={<VideoCamera className="w-4 h-4" weight="fill" />}
              color="vidit"
              items={vidItColumn}
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
