import {
	PlusIcon,
	SpinnerIcon,
	UploadIcon,
	XIcon,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAction, useQuery } from "convex/react";
import { format, isValid, parseISO } from "date-fns";
import { useAtom } from "jotai";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select-new";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/useFileUpload";
import { isConvexStorageId } from "@/lib/storage";
import { defaultIdeaDraft, type IdeaDraft, ideaDraftAtom } from "@/store/atoms";
import type { Idea } from "./KanbanBoard";

interface EditIdeaModalProps {
	idea: Idea | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	organizationId?: string;
}

const parseDateValue = (value: string) => {
	if (!value) return undefined;
	const parsed = parseISO(value);
	return isValid(parsed) ? parsed : undefined;
};

const formatDateValue = (value: string) => {
	const parsed = parseDateValue(value);
	return parsed ? format(parsed, "PPP") : "Pick a date";
};

function ThumbnailPreview({ thumbnail }: { thumbnail: string }) {
	const storageUrl = useQuery(
		api.files.getUrl,
		isConvexStorageId(thumbnail)
			? { storageId: thumbnail as Id<"_storage"> }
			: "skip",
	);
	const imageUrl = isConvexStorageId(thumbnail) ? storageUrl : thumbnail;

	if (!imageUrl) return null;
	return (
		<img
			src={imageUrl}
			alt="Thumbnail"
			className="w-full h-full object-cover"
		/>
	);
}

export function EditIdeaModal({
	idea,
	open,
	onOpenChange,
	organizationId,
}: EditIdeaModalProps) {
	const [draft, setDraft] = useAtom(ideaDraftAtom);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const {
		file: thumbnailFile,
		preview: thumbnailPreview,
		isUploading,
		fileInputRef,
		handleFileSelect: onFileSelect,
		upload: uploadFile,
		clear: clearFileUpload,
	} = useFileUpload();

	const updateIdea = useAction(api.ideas.update);

	const updateDraft = (updates: Partial<IdeaDraft>) => {
		setDraft((prev) => ({ ...prev, ...updates }));
	};

	const ideaId = draft.ideaId ?? idea?._id ?? null;
	const currentIdea = useQuery(
		api.ideas.get,
		open && ideaId ? { id: ideaId, organizationId } : "skip",
	);
	const ideaSource = currentIdea ?? idea ?? null;

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		onFileSelect(e);
		updateDraft({ thumbnail: "", thumbnailReady: true });
	};

	const updateResource = (index: number, value: string) => {
		updateDraft({
			resources: draft.resources.map((resource, resourceIndex) =>
				resourceIndex === index ? value : resource,
			),
		});
	};

	const addResource = () => {
		updateDraft({ resources: [...draft.resources, ""] });
	};

	const removeResource = (index: number) => {
		const nextResources = draft.resources.filter(
			(_, resourceIndex) => resourceIndex !== index,
		);
		updateDraft({ resources: nextResources.length ? nextResources : [""] });
	};

	const clearThumbnail = () => {
		clearFileUpload();
		updateDraft({ thumbnail: "", thumbnailReady: false });
	};

	const handleSubmit = async (e: React.SubmitEvent) => {
		e.preventDefault();
		if (!ideaId || !draft.title.trim()) return;

		setIsSubmitting(true);
		try {
			const trimmedThumbnail = draft.thumbnail.trim();
			const wantsClear =
				!thumbnailFile &&
				!trimmedThumbnail &&
				!thumbnailPreview &&
				Boolean(ideaSource?.thumbnail);
			let finalThumbnail: string | undefined = trimmedThumbnail || undefined;

			if (thumbnailFile) {
				finalThumbnail = (await uploadFile()) ?? undefined;
			}

			const finalThumbnailReady =
				draft.thumbnailReady || Boolean(finalThumbnail);

			await updateIdea({
				id: ideaId,
				title: draft.title.trim(),
				description: draft.description.trim() || undefined,
				notes: draft.notes.trim() || undefined,
				thumbnail: finalThumbnail,
				clearThumbnail: wantsClear ? true : undefined,
				thumbnailReady: finalThumbnailReady,
				resources: draft.resources.filter((r) => r.trim()),
				recorded: draft.recorded,
				vodRecordingDate: draft.vodRecordingDate || undefined,
				releaseDate: draft.releaseDate || undefined,
				owner: draft.owner || undefined,
				channel: draft.channel || undefined,
				potential:
					typeof draft.potential === "number" ? draft.potential : undefined,
				label: draft.label || undefined,
				adReadTracker: draft.adReadTracker || undefined,
				unsponsored: draft.unsponsored,
				organizationId,
			});

			toast.success("Idea updated successfully");
			setDraft(defaultIdeaDraft);
			clearFileUpload();
			onOpenChange(false);
		} catch (error) {
			void error;
			toast.error("Failed to update idea. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentThumbnail =
		thumbnailPreview ||
		(draft.thumbnail && !thumbnailFile ? draft.thumbnail : null);

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			clearFileUpload();
		}
		onOpenChange(nextOpen);
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
				<DialogHeader className="sr-only">
					<DialogTitle>Edit Idea</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
					{/* Title & Description */}
					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="edit-title" className="text-sm">
								Title <span className="text-destructive">*</span>
							</Label>
							<Input
								id="edit-title"
								type="text"
								value={draft.title}
								onChange={(e) => updateDraft({ title: e.target.value })}
								placeholder="What's the hook?"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edit-description" className="text-sm">
								Description
							</Label>
							<Input
								id="edit-description"
								value={draft.description}
								onChange={(e) => updateDraft({ description: e.target.value })}
								placeholder="One-line summary"
							/>
						</div>
					</div>

					{/* Resources */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-resources" className="text-sm">
							Resources
						</Label>
						<div className="grid grid-cols-2 gap-2">
							{draft.resources.map((resource, index) => (
								<div
									key={`resource-${index}`}
									className="flex items-center gap-2"
								>
									<Input
										id={index === 0 ? "edit-resources" : undefined}
										type="url"
										value={resource}
										onChange={(e) => updateResource(index, e.target.value)}
										placeholder={
											index === 0 ? "Add resource URL" : "Another resource URL"
										}
										className="flex-1"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => removeResource(index)}
										disabled={draft.resources.length === 1 && !resource}
										aria-label="Remove resource"
									>
										<XIcon className="w-4 h-4" />
									</Button>
								</div>
							))}
							<div className="col-span-2">
								<Button
									type="button"
									variant="ghost"
									className="justify-start px-2"
									onClick={addResource}
								>
									<PlusIcon className="w-4 h-4 mr-2" />
									Add resource
								</Button>
							</div>
						</div>
					</div>

					{/* Thumbnail + Dates */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label className="text-sm">Thumbnail</Label>
							{currentThumbnail ? (
								<div className="group relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-muted/30">
									{thumbnailPreview ? (
										<img
											src={thumbnailPreview}
											alt="Thumbnail preview"
											className="w-full h-full object-cover"
										/>
									) : (
										<ThumbnailPreview thumbnail={draft.thumbnail} />
									)}
									<button
										type="button"
										onClick={clearThumbnail}
										className="absolute top-2 right-2 p-1 bg-background/80 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<XIcon className="w-3.5 h-3.5" />
									</button>
								</div>
							) : (
								<div className="flex gap-2">
									<Input
										type="url"
										value={draft.thumbnail}
										onChange={(e) => {
											const nextThumbnail = e.target.value;
											updateDraft({
												thumbnail: nextThumbnail,
												thumbnailReady: Boolean(nextThumbnail),
											});
											clearFileUpload();
										}}
										placeholder="Paste image URL"
										className="flex-1"
									/>
									<input
										ref={fileInputRef}
										type="file"
										accept="image/*"
										onChange={handleFileSelect}
										className="hidden"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={() => fileInputRef.current?.click()}
									>
										<UploadIcon className="w-4 h-4" />
									</Button>
								</div>
							)}
							<div className="flex items-center gap-2 pt-1">
								<Switch
									id="edit-thumbnail-ready"
									checked={draft.thumbnailReady}
									onChange={(e) =>
										updateDraft({ thumbnailReady: e.target.checked })
									}
								/>
								<Label
									htmlFor="edit-thumbnail-ready"
									className="text-sm text-muted-foreground font-normal"
								>
									Thumbnail ready
								</Label>
							</div>
						</div>

						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="edit-vod-date" className="text-sm">
									VOD Date
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											id="edit-vod-date"
											variant="outline"
											data-empty={!draft.vodRecordingDate}
											className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
										>
											{formatDateValue(draft.vodRecordingDate)}
											<ChevronDownIcon className="w-4 h-4" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={parseDateValue(draft.vodRecordingDate)}
											onSelect={(date) =>
												updateDraft({
													vodRecordingDate: date
														? format(date, "yyyy-MM-dd")
														: "",
												})
											}
											defaultMonth={parseDateValue(draft.vodRecordingDate)}
										/>
									</PopoverContent>
								</Popover>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="edit-release-date" className="text-sm">
									Release Date
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											id="edit-release-date"
											variant="outline"
											data-empty={!draft.releaseDate}
											className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
										>
											{formatDateValue(draft.releaseDate)}
											<ChevronDownIcon className="w-4 h-4" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0" align="start">
										<Calendar
											mode="single"
											selected={parseDateValue(draft.releaseDate)}
											onSelect={(date) =>
												updateDraft({
													releaseDate: date ? format(date, "yyyy-MM-dd") : "",
												})
											}
											defaultMonth={parseDateValue(draft.releaseDate)}
										/>
									</PopoverContent>
								</Popover>
							</div>
							<div className="flex items-center justify-between gap-4 pt-1">
								<div className="flex items-center gap-2">
									<Switch
										id="edit-recorded"
										checked={draft.recorded}
										onChange={(e) =>
											updateDraft({ recorded: e.target.checked })
										}
									/>
									<Label
										htmlFor="edit-recorded"
										className="text-sm text-muted-foreground font-normal"
									>
										Recorded
									</Label>
								</div>

								<div className="flex items-center gap-2">
									<Switch
										id="edit-unsponsored"
										checked={draft.unsponsored}
										onChange={(e) =>
											updateDraft({ unsponsored: e.target.checked })
										}
									/>
									<Label
										htmlFor="edit-unsponsored"
										className="text-sm text-muted-foreground font-normal"
									>
										Unsponsored
									</Label>
								</div>
							</div>
						</div>
					</div>

					{/* Owner, Channel Row */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="edit-owner" className="text-sm">
								Owner
							</Label>
							<Select
								value={draft.owner || undefined}
								onValueChange={(value) =>
									updateDraft({ owner: value as Idea["owner"] })
								}
							>
								<SelectTrigger id="edit-owner">
									<SelectValue placeholder="Not set" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="Theo">Theo</SelectItem>
									<SelectItem value="Phase">Phase</SelectItem>
									<SelectItem value="Ben">Ben</SelectItem>
									<SelectItem value="shivam">Shivam</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edit-channel" className="text-sm">
								Channel
							</Label>
							<Select
								value={draft.channel || undefined}
								onValueChange={(value) =>
									updateDraft({ channel: value as Idea["channel"] })
								}
							>
								<SelectTrigger id="edit-channel">
									<SelectValue placeholder="Not set" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="main">Main</SelectItem>
									<SelectItem value="theo rants">Theo Rants</SelectItem>
									<SelectItem value="theo throwaways">
										Theo Throwaways
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Priority, Potential, Ad Track Reader Row */}
					<div className="grid grid-cols-3 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="edit-label" className="text-sm">
								Priority
							</Label>
							<Select
								value={draft.label || undefined}
								onValueChange={(value) =>
									updateDraft({ label: value as Idea["label"] })
								}
							>
								<SelectTrigger id="edit-label">
									<SelectValue placeholder="Not set" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="high priority">High</SelectItem>
									<SelectItem value="mid priority">Medium</SelectItem>
									<SelectItem value="low priority">Low</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edit-potential" className="text-sm">
								Potential
							</Label>
							<Select
								value={
									draft.potential !== "" ? String(draft.potential) : undefined
								}
								onValueChange={(value) =>
									updateDraft({ potential: Number(value) })
								}
							>
								<SelectTrigger id="edit-potential">
									<SelectValue placeholder="Not set" />
								</SelectTrigger>
								<SelectContent>
									{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
										<SelectItem key={n} value={String(n)}>
											{n}/10
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="edit-ad-read-tracker" className="text-sm">
								Ad Track Reader
							</Label>
							<Select
								value={draft.adReadTracker || undefined}
								onValueChange={(value) =>
									updateDraft({ adReadTracker: value as Idea["adReadTracker"] })
								}
							>
								<SelectTrigger id="edit-ad-read-tracker">
									<SelectValue placeholder="Not set" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="planned">Planned</SelectItem>
									<SelectItem value="in da edit">In Da Edit</SelectItem>
									<SelectItem value="done">Done</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="edit-notes" className="text-sm">
							Notes
						</Label>
						<Textarea
							id="edit-notes"
							value={draft.notes}
							onChange={(e) => updateDraft({ notes: e.target.value })}
							placeholder="Loose thoughts, beats, punchlines…"
							className="min-h-[120px] resize-none"
						/>
					</div>
				</form>

				<DialogFooter className="px-6 py-4 border-t border-border/40">
					<Button
						type="button"
						variant="ghost"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						disabled={!draft.title.trim() || isSubmitting}
					>
						{isSubmitting ? (
							<>
								<SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
								{isUploading ? "Uploading…" : "Saving…"}
							</>
						) : (
							"Save Changes"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
