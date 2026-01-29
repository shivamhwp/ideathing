import { useDroppable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Plus, DotsThree, Lightbulb, VideoCamera } from "@phosphor-icons/react";
import { useRef, type ReactNode } from "react";
import { cn } from "@/utils/utils";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";

interface KanbanColumnProps {
  id: "ideas" | "vid-it";
  title: string;
  icon: ReactNode;
  color: "ideas" | "vidit";
  items: Idea[];
  onAddClick?: () => void;
}

export function KanbanColumn({
  id,
  title,
  icon,
  color,
  items,
  onAddClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kanban-column group",
        isOver && "ring-2 ring-primary/30 border-primary/50"
      )}
    >
      {/* Column Header */}
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span className={cn("status-dot", `status-dot-${color}`)} />
          <span>{title}</span>
        </div>
        <span className="kanban-column-count">{items.length}</span>

        <div className="kanban-column-actions">
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="column-add-button"
              title="Add idea"
            >
              <Plus className="w-4 h-4" weight="bold" />
            </button>
          )}
          <button className="column-add-button" title="More options">
            <DotsThree className="w-4 h-4" weight="bold" />
          </button>
        </div>
      </div>

      {/* Column Content */}
      {items.length === 0 ? (
        <div className="kanban-empty">
          <div className="kanban-empty-icon">
            {id === "ideas" ? (
              <Lightbulb className="w-5 h-5 text-muted-foreground/50" weight="duotone" />
            ) : (
              <VideoCamera className="w-5 h-5 text-muted-foreground/50" weight="duotone" />
            )}
          </div>
          <p className="kanban-empty-text">
            {id === "ideas"
              ? "Add your first idea"
              : "Drag ideas here when ready"}
          </p>
          {onAddClick && (
            <button
              onClick={onAddClick}
              className="mt-3 text-xs text-primary/70 hover:text-primary transition-colors"
            >
              + Add idea
            </button>
          )}
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="kanban-column-content"
        >
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const idea = items[virtualItem.index];
              return (
                <div
                  key={idea._id}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full pb-2 px-0.5 animate-fade-in opacity-0"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                    animationDelay: `${Math.min(virtualItem.index * 0.02, 0.2)}s`,
                  }}
                >
                  <IdeaCard idea={idea} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
