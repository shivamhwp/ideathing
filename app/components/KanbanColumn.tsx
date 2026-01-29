import { useDroppable } from "@dnd-kit/core";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";
import type { ReactNode } from "react";

interface KanbanColumnProps {
  id: "ideas" | "vidit";
  title: string;
  icon: ReactNode;
  color: "amber" | "emerald";
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
      bg: "bg-amber-50",
      border: "border-amber-200",
      header: "bg-amber-100 text-amber-800",
      icon: "text-amber-600",
    },
    emerald: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      header: "bg-emerald-100 text-emerald-800",
      icon: "text-emerald-600",
    },
  };

  const colors = colorClasses[color];

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${colors.bg} border-2 ${
        isOver ? "border-blue-400" : colors.border
      } transition-colors duration-200`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colors.header} mb-4`}
      >
        <span className={colors.icon}>{icon}</span>
        <h3 className="font-semibold">{title}</h3>
        <span className="ml-auto bg-white/50 px-2 py-0.5 rounded-full text-sm">
          {items.length}
        </span>
      </div>

      <div className="space-y-3 flex-1">
        {items.map((idea) => (
          <IdeaCard key={idea._id} idea={idea} />
        ))}

        {items.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">
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
