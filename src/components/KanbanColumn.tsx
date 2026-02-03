import { useDroppable } from "@dnd-kit/core";
import {
  LightbulbIcon,
  LockIcon,
  NotionLogoIcon,
  PlusIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
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
  isSignedIn?: boolean;
  isNotionConnected?: boolean;
}

export function KanbanColumn({
  id,
  title,
  color,
  items,
  onAddClick,
  onItemClick,
  isSignedIn = true,
  isNotionConnected = true,
}: KanbanColumnProps) {
  const isDisabled = id === "to-stream" && (!isSignedIn || !isNotionConnected);
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: isDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full overflow-hidden rounded-xl border border-border/50 bg-card/50 p-3 transition-colors",
        isOver && !isDisabled && "ring-2 ring-primary/30 border-primary/50 bg-primary/5",
        isDisabled && "opacity-60",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 min-h-9">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              color === "concept" ? "bg-amber-500" : "bg-pink-500",
              isDisabled && "opacity-50",
            )}
          />
          <span
            className={cn(
              "text-sm font-medium text-foreground",
              isDisabled && "text-muted-foreground",
            )}
          >
            {title}
          </span>
          <span className="text- text-muted-foreground/50">{items.length}</span>
          {isDisabled && <LockIcon className="w-3.5 h-3.5 text-muted-foreground" weight="fill" />}
        </div>
        <div className="flex items-center justify-end">
          {onAddClick && isSignedIn ? (
            <Button
              onClick={onAddClick}
              variant="secondary"
              className="cursor-pointer"
              size="icon"
              aria-label="Add idea"
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
            </Button>
          ) : (
            <div className="h-9 w-9" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Disabled message for to-stream column */}
      {isDisabled && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/70 gap-3 px-4">
          <div className="flex items-center gap-2">
            <NotionLogoIcon className="w-6 h-6" weight="fill" />
            <LockIcon className="w-4 h-4" weight="fill" />
          </div>
          <p className="text-xs text-center">Connect Notion to move ideas to "To Stream"</p>
        </div>
      )}

      {/* Grid of cards */}
      {!isDisabled && items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
          {id === "concept" ? (
            <LightbulbIcon className="w-8 h-8 mb-2" weight="duotone" />
          ) : (
            <VideoCameraIcon className="w-8 h-8 mb-2" weight="duotone" />
          )}
          <p className="text-xs">
            {id === "concept" ? "Add your first concept" : "Drag ideas here"}
          </p>
        </div>
      ) : items.length > 0 ? (
        <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((idea) => (
              <IdeaCard key={idea._id} idea={idea} onClick={() => onItemClick?.(idea)} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
