import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash, Star } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { isConvexStorageId } from "@/lib/storage";
import { cn } from "@/utils/utils";
import { DeleteIdeaDialog } from "./DeleteIdeaDialog";
import type { Idea } from "./KanbanBoard";

interface IdeaCardProps {
  idea: Idea;
  onClick?: () => void;
}

function ThumbnailImage({ thumbnail, alt }: { thumbnail: string; alt: string }) {
  const storageUrl = useQuery(
    api.files.getUrl,
    isConvexStorageId(thumbnail) ? { storageId: thumbnail as Id<"_storage"> } : "skip",
  );

  const imageUrl = isConvexStorageId(thumbnail) ? storageUrl : thumbnail;

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

type DisplayStatus = "idea" | "To Stream" | "Recorded";

const statusColors: Record<DisplayStatus, string> = {
  idea: "bg-muted text-muted-foreground",
  "To Stream": "bg-secondary text-secondary-foreground",
  Recorded: "bg-primary text-primary-foreground",
};

const getDisplayStatus = (idea: Idea): DisplayStatus => {
  if (idea.recorded) return "Recorded";
  return idea.column === "ideas" ? "idea" : "To Stream";
};

export function IdeaCard({ idea, onClick }: IdeaCardProps) {
  const deleteIdea = useAction(api.ideas.remove);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
    transition: transition || "transform 200ms ease, opacity 200ms ease",
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteIdea({ id: idea._id });
      toast.success("Idea deleted");
    } catch (error) {
      void error;
      toast.error("Failed to delete idea");
    }
    setShowDeleteDialog(false);
  };

  const handleClick = () => {
    if (!isSortableDragging && onClick) {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group cursor-pointer",
        isSortableDragging && "opacity-0",
      )}
      onClick={handleClick}
    >
      {/* Compact card */}
      <div className="rounded-lg overflow-hidden bg-card border border-border/60 hover:border-border hover:shadow-sm transition-all duration-200">
        {/* Thumbnail - shorter aspect ratio */}
        <div
          className="relative aspect-[2/1] overflow-hidden bg-muted"
          {...attributes}
          {...listeners}
        >
          {idea.thumbnail ? (
            <ThumbnailImage thumbnail={idea.thumbnail} alt={idea.title} />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-muted to-accent/50" />
          )}

          {/* Delete button on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <button
              onClick={handleDeleteClick}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-md bg-black/50 backdrop-blur-sm text-white/80 hover:bg-destructive hover:text-white transition-colors"
              title="Delete"
            >
              <Trash className="w-3.5 h-3.5" weight="bold" />
            </button>
          </div>
        </div>

        {/* Content - minimal */}
        <div className="p-2.5 space-y-1.5">
          {/* Title */}
          <h3 className="text-[13px] font-medium text-foreground leading-tight line-clamp-2">
            {idea.title}
          </h3>

          {/* Meta row: status, channel, potential */}
          <div className="flex items-center gap-1.5 text-[10px]">
            {(() => {
              const displayStatus = getDisplayStatus(idea);
              return (
                <span className={cn("px-1.5 py-0.5 rounded font-medium", statusColors[displayStatus])}>
                  {displayStatus === "idea" ? "Idea" : displayStatus}
                </span>
              );
            })()}
            {idea.channel && (
              <span className="text-muted-foreground capitalize">
                {idea.channel}
              </span>
            )}
            {typeof idea.potential === "number" && (
              <span className="flex items-center gap-0.5 text-primary ml-auto font-medium">
                <Star className="w-3 h-3" weight="fill" />
                {idea.potential}
              </span>
            )}
          </div>
        </div>
      </div>

      <DeleteIdeaDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        ideaTitle={idea.title}
      />
    </div>
  );
}
