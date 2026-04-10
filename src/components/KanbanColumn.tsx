import { useDroppable } from "@dnd-kit/core";
import { LightbulbIcon, PlusIcon, VideoCameraIcon } from "@phosphor-icons/react";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NON_THEO_IDEA_CARD_GRID_TEMPLATE } from "@/components/idea-grid";
import { cn } from "@/utils/utils";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";

interface KanbanColumnProps {
  id: "concept" | "to-stream";
  title: string;
  color: "concept" | "to-stream";
  items: Idea[];
  onAddClick?: () => void;
  onItemClick?: (idea: Idea) => void;
  interactive?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<Id<"ideas">>;
  onToggleSelect?: (ideaId: Id<"ideas">) => void;
  focusedIdeaId?: Id<"ideas"> | null;
  getIdeaDomId?: (ideaId: Id<"ideas">) => string;
}

export function KanbanColumn({
  id,
  title,
  color,
  items,
  onAddClick,
  onItemClick,
  interactive = true,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  focusedIdeaId,
  getIdeaDomId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: !interactive || selectionMode,
  });
  const showAddButton = !!onAddClick && interactive;
  const emptyStateIconClassName = "mb-2 h-12 w-12";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 min-w-0 snap-start flex-col overflow-hidden rounded-xl border border-border/50 bg-card/50 p-3 transition-colors",
        isOver && interactive && "ring-2 ring-primary/30 border-primary/50 bg-primary/5",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 min-h-9">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              color === "concept" ? "bg-amber-500" : "bg-pink-500",
            )}
          />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground/50">{items.length}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {showAddButton ? (
            <Button
              onClick={onAddClick}
              variant="secondary"
              className="cursor-pointer"
              size="icon"
              aria-label="Add idea"
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
            </Button>
          ) : onAddClick ? (
            <div className="h-9 w-9" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      {/* Grid of cards */}
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-xl text-muted-foreground/25">
          {id === "concept" ? (
            <LightbulbIcon className={emptyStateIconClassName} weight="duotone" />
          ) : (
            <VideoCameraIcon className={emptyStateIconClassName} weight="duotone" />
          )}
          {id === "concept" ? "Add your first concept" : "Drag ideas here"}
        </div>
      ) : items.length > 0 ? (
        <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div
            className="grid content-start justify-start gap-3"
            style={{ gridTemplateColumns: NON_THEO_IDEA_CARD_GRID_TEMPLATE }}
          >
            {items.map((idea) => (
              <div key={idea._id} className="min-w-0">
                <IdeaCard
                  idea={idea}
                  onClick={() => onItemClick?.(idea)}
                  interactive={interactive}
                  selectionMode={selectionMode}
                  selected={selectedIds?.has(idea._id) ?? false}
                  onToggleSelect={onToggleSelect}
                  isKeyboardFocused={focusedIdeaId === idea._id}
                  domId={getIdeaDomId?.(idea._id)}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
