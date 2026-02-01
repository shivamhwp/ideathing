import { useDroppable } from "@dnd-kit/core";
import { Lightbulb, PlusIcon, VideoCamera } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { IdeaCard } from "./IdeaCard";
import type { Idea } from "./KanbanBoard";

interface KanbanColumnProps {
	id: "ideas" | "to-stream";
	title: string;
	color: "ideas" | "vidit";
	items: Idea[];
	onAddClick?: () => void;
	onItemClick?: (idea: Idea) => void;
	isSignedIn?: boolean;
	organizationId?: string;
}

export function KanbanColumn({
	id,
	title,
	color,
	items,
	onAddClick,
	onItemClick,
	isSignedIn = true,
	organizationId,
}: KanbanColumnProps) {
	const { setNodeRef, isOver } = useDroppable({ id });

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"flex flex-col h-full overflow-hidden rounded-xl border border-border/50 bg-card/50 p-3 transition-colors",
				isOver && "ring-2 ring-primary/30 border-primary/50 bg-primary/5",
			)}
		>
			{/* Column Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"w-2 h-2 rounded-full",
							color === "ideas" ? "bg-amber-500" : "bg-pink-500",
						)}
					/>
					<span className="text-sm font-medium text-foreground">{title}</span>
					<span className="text-xs text-muted-foreground">
						({items.length})
					</span>
				</div>
				{onAddClick && isSignedIn && (
					<Button onClick={onAddClick} variant="secondary">
						<PlusIcon className="w-4 h-4" weight="bold" />
					</Button>
				)}
			</div>

			{/* Grid of cards */}
			{items.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/50">
					{id === "ideas" ? (
						<Lightbulb className="w-8 h-8 mb-2" weight="duotone" />
					) : (
						<VideoCamera className="w-8 h-8 mb-2" weight="duotone" />
					)}
					<p className="text-xs">
						{id === "ideas" ? "Add your first idea" : "Drag ideas here"}
					</p>
				</div>
			) : (
				<div className="flex-1 overflow-y-auto min-h-0">
					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
						{items.map((idea) => (
							<IdeaCard
								key={idea._id}
								idea={idea}
								onClick={() => onItemClick?.(idea)}
								organizationId={organizationId}
							/>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
