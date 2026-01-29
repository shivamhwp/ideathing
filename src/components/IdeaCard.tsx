import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical, Trash, Link, Image } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { cn } from "@/utils/utils";
import type { Idea } from "./KanbanBoard";

interface IdeaCardProps {
  idea: Idea;
  isDragging?: boolean;
}

export function IdeaCard({ idea, isDragging = false }: IdeaCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const deleteIdea = useMutation(api.ideas.remove);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: idea._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteIdea({ id: idea._id });
  };

  // Generate a short ID for display (like DEV-109)
  const shortId = `IDEA-${idea._id.slice(-3).toUpperCase()}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "idea-card",
        (isDragging || isSortableDragging) && "dragging"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Actions - visible on hover */}
      <div className="idea-card-actions">
        <button
          onClick={handleDelete}
          className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete idea"
        >
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-2.5">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="drag-handle mt-0.5 flex-shrink-0"
        >
          <DotsSixVertical className="w-4 h-4" weight="bold" />
        </button>

        <div className="flex-1 min-w-0 space-y-2">
          {/* ID Badge */}
          <span className="idea-card-id">{shortId}</span>

          {/* Title */}
          <h4 className="idea-card-title">{idea.title}</h4>

          {/* Thumbnail */}
          {idea.thumbnail && (
            <div className="idea-card-thumbnail">
              <img
                src={idea.thumbnail}
                alt={idea.title}
                loading="lazy"
              />
            </div>
          )}

          {/* Description */}
          {idea.description && (
            <p className="idea-card-description">{idea.description}</p>
          )}

          {/* Footer with resources and metadata */}
          <div className="flex items-center gap-2 pt-1">
            {/* Resources */}
            {idea.resources && idea.resources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {idea.resources.slice(0, 3).map((resource, idx) => (
                  <a
                    key={idx}
                    href={resource}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="idea-card-resource"
                    onClick={(e) => e.stopPropagation()}
                    title={resource}
                  >
                    <Link className="w-3 h-3" weight="bold" />
                    <span>Link {idx + 1}</span>
                  </a>
                ))}
                {idea.resources.length > 3 && (
                  <span className="text-[10px] text-muted-foreground/60 self-center">
                    +{idea.resources.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Thumbnail indicator if exists but not shown */}
            {idea.thumbnail && (
              <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground/50">
                <Image className="w-3 h-3" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
