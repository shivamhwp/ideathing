import { useDroppable } from "@dnd-kit/core";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";
import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

interface KanbanColumnProps {
  id: "ideas" | "vidit";
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
        "kanban-column border",
        colors.bg,
        isOver ? "border-primary" : colors.border,
        "transition-colors duration-200"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-md mb-3",
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

      <div className="space-y-2 flex-1">
        {items.map((idea) => (
          <IdeaCard key={idea._id} idea={idea} />
        ))}

        {items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-xs">
              {id === "ideas"
                ? "Add your first idea!"
                : "Drag ideas here when ready to film"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
