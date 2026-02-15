import { useDroppable } from "@dnd-kit/core";
import {
  ArrowClockwiseIcon,
  LightbulbIcon,
  PlusIcon,
  VideoCameraIcon,
} from "@phosphor-icons/react";
import type { Id } from "convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";

export type ToStreamSyncState = "disconnected" | "pending" | "synced";

interface KanbanColumnProps {
  id: "concept" | "to-stream";
  title: string;
  color: "concept" | "to-stream";
  items: Idea[];
  onAddClick?: () => void;
  onItemClick?: (idea: Idea) => void;
  interactive?: boolean;
  toStreamSyncState?: ToStreamSyncState;
  selectionMode?: boolean;
  selectedIds?: Set<Id<"ideas">>;
  onToggleSelect?: (ideaId: Id<"ideas">) => void;
}

export function KanbanColumn({
  id,
  title,
  color,
  items,
  onAddClick,
  onItemClick,
  interactive = true,
  toStreamSyncState,
  selectionMode = false,
  selectedIds,
  onToggleSelect,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled: !interactive || selectionMode,
  });
  const shouldShowSyncState = id === "to-stream" && !!toStreamSyncState;
  const syncStateLabel = {
    disconnected: "Disconnected",
    pending: "Sync pending",
    synced: "Synced",
  } as const;
  const syncStateClassName = {
    disconnected: "border-border/60 bg-muted/20 text-muted-foreground",
    pending: "border-amber-500/40 bg-amber-500/15 text-amber-700",
    synced: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700",
  } as const;
  const showAddButton = !!onAddClick && interactive;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col h-full min-h-0 overflow-hidden rounded-xl border border-border/50 bg-card/50 p-3 transition-colors",
        isOver && interactive && "ring-2 ring-primary/30 border-primary/50 bg-primary/5",
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 min-h-9">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              color === "concept" ? "bg-amber-500" : "bg-pink-500",
            )}
          />
          <span className="text-sm font-medium text-foreground">{title}</span>
          <span className="text-xs text-muted-foreground/50">{items.length}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {shouldShowSyncState && toStreamSyncState && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
                syncStateClassName[toStreamSyncState],
              )}
            >
              <ArrowClockwiseIcon
                className={cn("w-3.5 h-3.5", toStreamSyncState === "pending" && "animate-spin")}
                weight="bold"
              />
              {syncStateLabel[toStreamSyncState]}
            </span>
          )}
          {showAddButton ? (
            <Button
              onClick={onAddClick}
              variant="secondary"
              className="cursor-pointer"
              size="icon"
              aria-label="Add idea"
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
            </Button>
          ) : onAddClick ? (
            <div className="h-9 w-9" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      {/* Grid of cards */}
      {items.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-xl text-muted-foreground/25">
          {id === "concept" ? (
            <LightbulbIcon className="w-8 h-8 mb-2" weight="duotone" />
          ) : (
            <VideoCameraIcon className="w-16 h-16" weight="duotone" />
          )}
          {id === "concept" ? "Add your first concept" : "Drag ideas here"}
        </div>
      ) : items.length > 0 ? (
        <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onClick={() => onItemClick?.(idea)}
                interactive={interactive}
                selectionMode={selectionMode}
                selected={selectedIds?.has(idea._id) ?? false}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
