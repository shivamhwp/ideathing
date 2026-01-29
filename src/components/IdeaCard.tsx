import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowSquareOut, DotsSixVertical, Trash } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Idea } from "./KanbanBoard";

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
			<div className="flex items-start gap-2">
				<button
					{...attributes}
					{...listeners}
					className="mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
				>
					<DotsSixVertical className="w-4 h-4" weight="bold" />
				</button>

				<div className="flex-1 min-w-0">
					{idea.thumbnail && (
						<div className="mb-2 rounded-md overflow-hidden bg-muted aspect-video">
							<img
								src={idea.thumbnail}
								alt={idea.title}
								className="w-full h-full object-cover"
							/>
						</div>
					)}

					<h4 className="font-medium text-foreground truncate text-sm">
						{idea.title}
					</h4>

					{idea.description && (
						<p className="text-xs text-muted-foreground mt-1 line-clamp-2">
							{idea.description}
						</p>
					)}

					{idea.resources && idea.resources.length > 0 && (
						<div className="flex flex-wrap gap-1.5 mt-2">
							{idea.resources.map((resource, index) => (
								<a
									key={index}
									href={resource}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded"
									onClick={(e) => e.stopPropagation()}
								>
									<ArrowSquareOut className="w-3 h-3" />
									Resource {index + 1}
								</a>
							))}
						</div>
					)}
				</div>

				{showDelete && (
					<Button
						variant="ghost"
						size="icon"
						onClick={handleDelete}
						className="h-6 w-6 text-muted-foreground hover:text-destructive"
					>
						<Trash className="w-3.5 h-3.5" />
					</Button>
				)}
			</div>
		</div>
	);
}
