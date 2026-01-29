import { useDroppable } from "@dnd-kit/core";
import { useVirtualizer } from "@tanstack/react-virtual";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";
import { useRef, type ReactNode } from "react";
import { cn } from "~/lib/utils";

interface KanbanColumnProps {
  id: "ideas" | "vid-it";
  title: string;
  icon: ReactNode;
  color: "amber" | "pink";
  items: Idea[];
}

export function KanbanColumn({
  id,
  title,
  icon,
  color,
  items,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 120, // Estimated item height
    overscan: 3, // Render 3 extra items above/below for smooth scrolling
  });

  const colorClasses = {
    amber: {
      bg: "bg-amber-50/50",
      border: "border-amber-200/50",
      header: "bg-amber-100/80 text-amber-800",
      icon: "text-amber-600",
      count: "bg-amber-200/50 text-amber-700",
    },
    pink: {
      bg: "bg-pink-50/50",
      border: "border-pink-200/50",
      header: "bg-pink-100/80 text-pink-800",
      icon: "text-pink-600",
      count: "bg-pink-200/50 text-pink-700",
    },
  };

  const colors = colorClasses[color];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "kanban-column border flex flex-col",
        colors.bg,
        isOver ? "border-primary" : colors.border,
        "transition-colors duration-200"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-3 flex-shrink-0",
          colors.header
        )}
      >
        <span className={colors.icon}>{icon}</span>
        <h3 className="font-medium text-sm">{title}</h3>
        <span
          className={cn(
            "ml-auto px-1.5 py-0.5 rounded text-xs font-medium",
            colors.count
          )}
        >
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground flex-1">
          <p className="text-xs">
            {id === "ideas"
              ? "Add your first idea!"
              : "Drag ideas here when ready to film"}
          </p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto min-h-0"
          style={{ maxHeight: "calc(100vh - 280px)" }}
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
                  className="absolute top-0 left-0 w-full pb-2"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
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
