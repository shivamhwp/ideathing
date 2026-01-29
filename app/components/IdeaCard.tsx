import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Idea } from "./KanbanBoard";
import { ExternalLink, GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";

interface IdeaCardProps {
  idea: Idea;
  isDragging?: boolean;
}

export function IdeaCard({ idea, isDragging = false }: IdeaCardProps) {
  const [showDelete, setShowDelete] = useState(false);
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`idea-card group ${
        isDragging || isSortableDragging ? "dragging" : ""
      }`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className="flex items-start gap-3">
        <button
          {...attributes}
          {...listeners}
          className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          {idea.thumbnail && (
            <div className="mb-3 rounded-lg overflow-hidden bg-gray-100 aspect-video">
              <img
                src={idea.thumbnail}
                alt={idea.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <h4 className="font-medium text-gray-900 truncate">{idea.title}</h4>

          {idea.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
              {idea.description}
            </p>
          )}

          {idea.resources && idea.resources.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {idea.resources.map((resource, index) => (
                <a
                  key={index}
                  href={resource}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  Resource {index + 1}
                </a>
              ))}
            </div>
          )}
        </div>

        {showDelete && (
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
