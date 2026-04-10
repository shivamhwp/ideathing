import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { StarIcon, TrashIcon } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useSetAtom } from "jotai";
import { toast } from "sonner";
import { formatDateValue } from "@/components/idea-form/date-utils";
import { useTheoMode } from "@/hooks/useTheoMode";
import { editIdeaIdAtom, editIdeaOpenAtom } from "@/store/atoms";
import { cn } from "@/utils/utils";
import type { Idea } from "./KanbanBoard";
import { Checkbox } from "./ui/checkbox";

interface IdeaCardProps {
  idea: Idea;
  onClick?: () => void;
  interactive?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (ideaId: Id<"ideas">) => void;
  isKeyboardFocused?: boolean;
  domId?: string;
}

function ThumbnailImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="absolute inset-0 w-full h-full object-cover"
    />
  );
}

type DisplayStatus = "Concept" | "To Stream" | "Recorded";

const statusColors: Record<DisplayStatus, string> = {
  Concept: "bg-muted text-muted-foreground",
  "To Stream": "bg-secondary text-secondary-foreground",
  Recorded: "bg-primary text-primary-foreground",
};

const getDisplayStatus = (idea: Idea): DisplayStatus => {
  if (idea.status === "Recorded") return "Recorded";
  if (idea.status === "To Stream") return "To Stream";
  return "Concept";
};

export function IdeaCard({
  idea,
  onClick,
  interactive = true,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  isKeyboardFocused = false,
  domId,
}: IdeaCardProps) {
  const { isTheoMode } = useTheoMode();
  const deleteIdea = useMutation(api.ideas.mutations.remove);
  const setEditIdeaId = useSetAtom(editIdeaIdAtom);
  const setEditIdeaOpen = useSetAtom(editIdeaOpenAtom);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: idea._id, disabled: selectionMode || !interactive });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 200ms ease, opacity 200ms ease",
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!interactive) return;
    void handleConfirmDelete();
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteIdea({ id: idea._id });
      setEditIdeaOpen(false);
      setEditIdeaId(null);
      toast.success("Idea deleted");
    } catch (error) {
      void error;
      toast.error("Failed to delete idea");
    }
  };

  const handleClick = () => {
    if (!interactive) {
      return;
    }
    if (!isSortableDragging && onClick) {
      onClick();
    }
  };

  const dragAttributes = selectionMode || !interactive ? {} : attributes;
  const dragListeners = selectionMode || !interactive ? {} : listeners;
  const releaseLabel = idea.releaseDate ? formatDateValue(idea.releaseDate) : "No release date";
  const recordedLabel = idea.status === "Recorded" ? "Recorded" : "Not recorded";
  const hasThumbnail = Boolean(idea.draftThumbnail);
  const thumbnailLabel = hasThumbnail ? "Thumbnail ready" : "No thumbnail";

  return (
    <div
      id={domId}
      data-idea-id={idea._id}
      ref={setNodeRef}
      style={style}
      className={cn(
        "group w-full",
        interactive ? "cursor-pointer" : "cursor-not-allowed",
        isSortableDragging && "opacity-40 scale-[0.98]",
      )}
      onClick={handleClick}
    >
      {isTheoMode ? (
        <div
          className={cn(
            "w-full overflow-hidden rounded-lg border bg-card transition-all duration-200 hover:border-border hover:shadow-sm",
            isKeyboardFocused ? "border-primary/50" : "border-border/60",
          )}
        >
          <div
            className="relative aspect-2/1 overflow-hidden bg-muted"
            {...dragAttributes}
            {...dragListeners}
          >
            <div
              className="absolute top-2 left-2 z-10"
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={selected}
                onCheckedChange={() => interactive && onToggleSelect?.(idea._id)}
                aria-label="Select idea"
              />
            </div>
            {idea.draftThumbnail ? (
              <ThumbnailImage src={idea.draftThumbnail} alt={idea.title} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <span className="text-xs text-muted-foreground">No thumbnail</span>
              </div>
            )}
            {interactive ? (
              <div className="absolute top-2 right-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="cursor-pointer rounded-md p-1.5 text-red-400 hover:bg-red-600/60 hover:text-white/70"
                  title="Delete"
                >
                  <TrashIcon className="h-3.5 w-3.5" weight="bold" />
                </button>
              </div>
            ) : null}
          </div>

          <div className="flex min-h-[58px] flex-col gap-1.5 p-2.5">
            <h3 className="min-h-[32px] line-clamp-2 text-[13px] font-medium leading-tight text-foreground">
              {idea.title}
            </h3>
            <div className="flex items-end justify-between gap-2 text-[10px]">
              <div className="flex min-w-0 items-center gap-1.5">
                {(() => {
                  const displayStatus = getDisplayStatus(idea);
                  return (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 font-medium",
                        statusColors[displayStatus],
                      )}
                    >
                      {displayStatus}
                    </span>
                  );
                })()}
                {idea.channel ? (
                  <span className="truncate text-muted-foreground">
                    {idea.channel.replace("C:", "")}
                  </span>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {typeof idea.potential === "number" ? (
                  <span className="flex items-center gap-0.5 font-medium text-primary">
                    <StarIcon className="h-3 w-3" weight="fill" />
                    {idea.potential}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "relative w-full rounded-xl border bg-card/70 p-3 transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm",
            isKeyboardFocused ? "border-primary/50" : "border-border/60",
          )}
          {...dragAttributes}
          {...dragListeners}
        >
          <div
            className="absolute top-3 right-3 z-10 shrink-0"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={() => interactive && onToggleSelect?.(idea._id)}
              aria-label="Select idea"
            />
          </div>

          <div className="flex min-h-[104px] flex-col justify-between gap-3">
            <div className="space-y-1.5 pr-10">
              <h3 className="line-clamp-3 text-[15px] font-medium leading-snug text-foreground/70">
                {idea.title}
              </h3>
              <p className="text-xs font-medium text-foreground/50">{releaseLabel}</p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium",
                    idea.status === "Recorded"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {recordedLabel}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-md px-2 py-1 text-[10px] font-medium",
                    hasThumbnail ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {thumbnailLabel}
                </span>
              </div>

              {interactive ? (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="shrink-0 cursor-pointer text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                  title="Delete"
                >
                  <TrashIcon className="h-4 w-4" weight="bold" />
                </button>
              ) : (
                <div className="h-7 w-7 shrink-0" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
