import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckCircle, Link, Trash, CurrencyDollar } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/utils/utils";
import type { Idea } from "./KanbanBoard";

interface IdeaCardProps {
  idea: Idea;
  isDragging?: boolean;
  onClick?: () => void;
}

function ThumbnailImage({ thumbnail, alt }: { thumbnail: string; alt: string }) {
  const isStorageId = thumbnail.startsWith("k") && !thumbnail.includes("://");

  const storageUrl = useQuery(
    api.files.getUrl,
    isStorageId ? { storageId: thumbnail as Id<"_storage"> } : "skip",
  );

  const imageUrl = isStorageId ? storageUrl : thumbnail;

  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt={alt}
      loading="lazy"
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

const priorityColors = {
  low: "bg-slate-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

export function IdeaCard({ idea, isDragging = false, onClick }: IdeaCardProps) {
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

  const handleClick = (e: React.MouseEvent) => {
    if (!isSortableDragging && onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("group cursor-pointer", isSortableDragging && "opacity-40 scale-[0.98]")}
      onClick={handleClick}
    >
      {/* Thumbnail - 16:9 aspect ratio like YouTube */}
      <div
        className="relative aspect-video rounded-lg overflow-hidden bg-muted/50 mb-2"
        {...attributes}
        {...listeners}
      >
        {idea.thumbnail ? (
          <ThumbnailImage thumbnail={idea.thumbnail} alt={idea.title} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
            <span className="text-xs">No thumbnail</span>
          </div>
        )}

        {/* Badges on thumbnail */}
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {idea.sponsored && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/90 text-white text-[10px] font-medium">
              <CurrencyDollar className="w-3 h-3" weight="bold" />
              Sponsored
            </span>
          )}
          {idea.priority && (
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-white text-[10px] font-medium capitalize",
                priorityColors[idea.priority],
              )}
            >
              {idea.priority}
            </span>
          )}
        </div>

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
          <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDelete}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-black/60 text-white/80 hover:text-white hover:bg-red-600 transition-colors"
              title="Delete"
            >
              <Trash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content below thumbnail */}
      <div className="px-0.5">
        <h3 className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {idea.title}
        </h3>

        {idea.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{idea.description}</p>
        )}

        {idea.resources && idea.resources.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {idea.resources.slice(0, 3).map((resource, idx) => (
              <a
                key={idx}
                href={resource}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] text-primary/70 hover:text-primary"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Link className="w-3 h-3" weight="bold" />
              </a>
            ))}
            {idea.resources.length > 3 && (
              <span className="text-[10px] text-muted-foreground/60">
                +{idea.resources.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
