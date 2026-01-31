import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus, SpinnerGap } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useNotionSync } from "@/hooks/useNotionSync";
import { AddIdeaModal } from "./AddIdeaModal";
import { EditIdeaModal } from "./EditIdeaModal";
import { KanbanColumn } from "./KanbanColumn";
import { Button } from "./ui/button";

export type Idea = {
	_id: Id<"ideas">;
	title: string;
	description?: string;
	notes?: string;
	thumbnail?: string | null;
	thumbnailReady?: boolean;
	resources?: string[];
	status?: "idea" | "To Stream" | "Recorded";
	vodRecordingDate?: string;
	releaseDate?: string;
	owner?: "Theo" | "Phase" | "Ben";
	channel?: "main" | "theo rants" | "theo throwaways";
	potential?: number;
	label?: "mid priority" | "low priority" | "high priority";
	adReadTracker?: "planned" | "in da edit" | "done";
	unsponsored?: boolean;
	column: "ideas" | "vid-it";
	order: number;
	notionPageId?: string;
};

export function KanbanBoard() {
	const ideas = useQuery(api.ideas.list);
	const moveIdea = useMutation(api.ideas.move);
	const [activeId, setActiveId] = useState<Id<"ideas"> | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [editingIdea, setEditingIdea] = useState<Idea | null>(null);

	useNotionSync(ideas);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 10,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	if (ideas === undefined) {
		return (
			<div className="flex items-center justify-center h-[50vh]">
				<SpinnerGap className="w-6 h-6 text-muted-foreground animate-spin" />
			</div>
		);
	}

	const ideasData = ideas ?? [];
	const ideasColumn = ideasData
		.filter((idea) => idea.column === "ideas")
		.sort((a, b) => a.order - b.order);
	const vidItColumn = ideasData
		.filter((idea) => idea.column === "vid-it")
		.sort((a, b) => a.order - b.order);

	const activeIdea = activeId
		? ideasData.find((idea) => idea._id === activeId)
		: null;

	function handleDragStart(event: DragStartEvent) {
		setActiveId(event.active.id as Id<"ideas">);
	}

	async function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveId(null);

		if (!over) return;

		const activeIdea = ideasData.find((idea) => idea._id === active.id);
		if (!activeIdea) return;

		let newColumn: "ideas" | "vid-it" = activeIdea.column;
		let newOrder = activeIdea.order;

		if (over.id === "ideas" || over.id === "vid-it") {
			newColumn = over.id as "ideas" | "vid-it";
			const columnItems = ideasData.filter((i) => i.column === newColumn);
			newOrder = columnItems.length;
		} else {
			const overIdea = ideasData.find((idea) => idea._id === over.id);
			if (overIdea) {
				newColumn = overIdea.column;
				newOrder = overIdea.order;
			}
		}

		if (activeIdea.column !== newColumn || activeIdea.order !== newOrder) {
			const nextStatus =
				activeIdea.column === "ideas" && newColumn === "vid-it"
					? "To Stream"
					: activeIdea.column === "vid-it" && newColumn === "ideas"
						? "idea"
						: undefined;

			await moveIdea({
				id: activeIdea._id,
				column: newColumn,
				order: newOrder,
				status: nextStatus,
			});
		}
	}

	function handleDragCancel() {
		setActiveId(null);
	}

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h2 className="text-base font-medium text-foreground">
					All Ideas
					<span className="ml-2 text-sm font-normal text-muted-foreground">
						{ideasData.length}
					</span>
				</h2>
				<Button size="sm" onClick={() => setShowAddModal(true)}>
					<Plus className="w-4 h-4 mr-1.5" weight="bold" />
					Add Idea
				</Button>
			</div>

			{/* Kanban Columns */}
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={handleDragCancel}
			>
				<div className="grid grid-cols-2 gap-4 w-full h-full">
					<SortableContext
						items={ideasColumn.map((i) => i._id)}
						strategy={rectSortingStrategy}
					>
						<KanbanColumn
							id="ideas"
							title="Ideas"
							color="ideas"
							items={ideasColumn}
							onAddClick={() => setShowAddModal(true)}
							onItemClick={setEditingIdea}
						/>
					</SortableContext>

					<SortableContext
						items={vidItColumn.map((i) => i._id)}
						strategy={rectSortingStrategy}
					>
						<KanbanColumn
							id="vid-it"
							title="move to to-stream"
							color="vidit"
							items={vidItColumn}
							onItemClick={setEditingIdea}
						/>
					</SortableContext>
				</div>

				<DragOverlay
					dropAnimation={{
						duration: 250,
						easing: "cubic-bezier(0.25, 1, 0.5, 1)",
					}}
				>
					{activeIdea ? (
						<div className="w-48 rotate-2 scale-105 shadow-2xl opacity-95 pointer-events-none">
							<div className="relative aspect-video rounded-lg overflow-hidden bg-muted mb-2 ring-2 ring-primary/30">
								{activeIdea.thumbnail &&
									!activeIdea.thumbnail.startsWith("k") && (
										<img
											src={activeIdea.thumbnail}
											alt={activeIdea.title}
											className="w-full h-full object-cover"
										/>
									)}
							</div>
							<h3 className="text-sm font-medium text-foreground line-clamp-2 px-0.5">
								{activeIdea.title}
							</h3>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			<AddIdeaModal open={showAddModal} onOpenChange={setShowAddModal} />
			<EditIdeaModal
				idea={editingIdea}
				open={!!editingIdea}
				onOpenChange={(open) => !open && setEditingIdea(null)}
			/>
		</div>
	);
}
