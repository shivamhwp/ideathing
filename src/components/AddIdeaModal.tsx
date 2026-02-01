import { Plus, SpinnerGap, Upload, X } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { format, isValid, parseISO } from "date-fns";
import { useAtom } from "jotai";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { defaultIdeaDraft, type IdeaDraft, ideaDraftAtom } from "@/store/atoms";

interface AddIdeaModalProps {
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

export function AddIdeaModal({
	open,
	onOpenChange,
	organizationId,
}: AddIdeaModalProps) {
	const [draft, setDraft] = useAtom(ideaDraftAtom);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [resourceCount, setResourceCount] = useState(
		draft.resources.length || 1,
	);

	// Refs for text inputs to avoid re-renders on keystroke
	const titleRef = useRef<HTMLInputElement>(null);
	const descriptionRef = useRef<HTMLInputElement>(null);
	const notesRef = useRef<HTMLTextAreaElement>(null);
	const thumbnailRef = useRef<HTMLInputElement>(null);
	const resourceRefs = useRef<(HTMLInputElement | null)[]>([]);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Debounced save to atom (200ms) - persists draft without causing re-renders
	const debouncedSaveToAtom = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			setDraft((prev) => ({
				...prev,
				title: titleRef.current?.value ?? prev.title,
				description: descriptionRef.current?.value ?? prev.description,
				notes: notesRef.current?.value ?? prev.notes,
				thumbnail: thumbnailRef.current?.value ?? prev.thumbnail,
				resources: resourceRefs.current
					.slice(0, resourceCount)
					.map((ref, i) => ref?.value ?? prev.resources[i] ?? ""),
			}));
		}, 200);
	}, [setDraft, resourceCount]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const {
		file: thumbnailFile,
		preview: thumbnailPreview,
		isUploading,
		fileInputRef,
		handleFileSelect: onFileSelect,
		upload: uploadFile,
		clear: clearFileUpload,
	} = useFileUpload();

	const createIdea = useMutation(api.ideas.create);

	// Sync refs with draft when dialog opens
	useEffect(() => {
		if (open) {
			if (titleRef.current) titleRef.current.value = draft.title;
			if (descriptionRef.current)
				descriptionRef.current.value = draft.description;
			if (notesRef.current) notesRef.current.value = draft.notes;
			if (thumbnailRef.current) thumbnailRef.current.value = draft.thumbnail;
			setResourceCount(draft.resources.length || 1);
			draft.resources.forEach((resource, index) => {
				if (resourceRefs.current[index]) {
					resourceRefs.current[index]!.value = resource;
				}
			});
		}
	}, [open, draft]);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		onFileSelect(e);
		if (thumbnailRef.current) thumbnailRef.current.value = "";
		setDraft((prev) => ({ ...prev, thumbnail: "", thumbnailReady: true }));
	};

	const addResource = () => {
		setResourceCount((prev) => prev + 1);
	};

	const removeResource = (index: number) => {
		if (resourceCount === 1) return;
		// Shift values up from removed index
		for (let i = index; i < resourceCount - 1; i++) {
			if (resourceRefs.current[i] && resourceRefs.current[i + 1]) {
				resourceRefs.current[i]!.value = resourceRefs.current[i + 1]!.value;
			}
		}
		setResourceCount((prev) => prev - 1);
	};

	const clearThumbnail = () => {
		clearFileUpload();
		if (thumbnailRef.current) thumbnailRef.current.value = "";
		setDraft((prev) => ({ ...prev, thumbnail: "", thumbnailReady: false }));
	};

	const clearAll = () => {
		setDraft(defaultIdeaDraft);
		clearFileUpload();
		setResourceCount(1);
		if (titleRef.current) titleRef.current.value = "";
		if (descriptionRef.current) descriptionRef.current.value = "";
		if (notesRef.current) notesRef.current.value = "";
		if (thumbnailRef.current) thumbnailRef.current.value = "";
		resourceRefs.current.forEach((ref) => {
			if (ref) ref.value = "";
		});
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const title = titleRef.current?.value.trim() || "";
		if (!title) return;

		setIsSubmitting(true);
		try {
			const description = descriptionRef.current?.value.trim() || "";
			const notes = notesRef.current?.value.trim() || "";
			const thumbnail = thumbnailRef.current?.value.trim() || "";
			const resources = resourceRefs.current
				.slice(0, resourceCount)
				.map((ref) => ref?.value.trim() || "")
				.filter(Boolean);

			let finalThumbnail: string | undefined;
			if (thumbnailFile) {
				finalThumbnail = (await uploadFile()) ?? undefined;
			} else if (thumbnail) {
				finalThumbnail = thumbnail;
			}

			await createIdea({
				title,
				description: description || undefined,
				notes: notes || undefined,
				thumbnail: finalThumbnail,
				thumbnailReady: draft.thumbnailReady || Boolean(finalThumbnail),
				resources,
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

			toast.success("Idea added successfully");
			clearAll();
			onOpenChange(false);
		} catch (error) {
			void error;
			toast.error("Failed to add idea. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const updateDraft = (updates: Partial<IdeaDraft>) => {
		setDraft((prev) => ({ ...prev, ...updates }));
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
				<DialogHeader className="sr-only">
					<DialogTitle>Add Idea</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
					{/* Title & Description */}
					<div className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="title" className="text-sm">
								Title <span className="text-destructive">*</span>
							</Label>
							<Input
								ref={titleRef}
								id="title"
								type="text"
								defaultValue={draft.title}
								onInput={debouncedSaveToAtom}
								placeholder="What's the hook?"
								autoFocus
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="description" className="text-sm">
								Description
							</Label>
							<Input
								ref={descriptionRef}
								id="description"
								defaultValue={draft.description}
								onInput={debouncedSaveToAtom}
								placeholder="One-line summary"
							/>
						</div>
					</div>

					{/* Resources */}
					<div className="space-y-1.5">
						<Label htmlFor="resources" className="text-sm">
							Resources
						</Label>
						<div className="grid grid-cols-2 gap-2">
							{Array.from({ length: resourceCount }).map((_, index) => (
								<div
									key={resourceRefs.current[index]?.value}
									className="flex items-center gap-2"
								>
									<Input
										ref={(el) => {
											resourceRefs.current[index] = el;
										}}
										id={index === 0 ? "resources" : undefined}
										type="url"
										defaultValue={draft.resources[index] || ""}
										onInput={debouncedSaveToAtom}
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
										disabled={
											resourceCount === 1 && !resourceRefs.current[0]?.value
										}
										aria-label="Remove resource"
									>
										<X className="w-4 h-4" />
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
									<Plus className="w-4 h-4 mr-2" />
									Add resource
								</Button>
							</div>
						</div>
					</div>

					{/* Thumbnail + Dates */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label className="text-sm">Thumbnail</Label>
							{thumbnailPreview ? (
								<div className="group relative rounded-lg overflow-hidden border border-border/40 aspect-video w-48 bg-muted/30">
									<img
										src={thumbnailPreview}
										alt="Thumbnail preview"
										className="w-full h-full object-cover"
									/>
									<button
										type="button"
										onClick={clearThumbnail}
										className="absolute top-2 right-2 p-1 bg-background/80 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
									>
										<X className="w-3.5 h-3.5" />
									</button>
								</div>
							) : (
								<div className="flex gap-2">
									<Input
										ref={thumbnailRef}
										type="url"
										defaultValue={draft.thumbnail}
										onInput={debouncedSaveToAtom}
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
										<Upload className="w-4 h-4" />
									</Button>
								</div>
							)}
							<div className="flex items-center gap-2 pt-1">
								<Switch
									id="thumbnail-ready"
									checked={draft.thumbnailReady}
									onChange={(e) =>
										updateDraft({ thumbnailReady: e.target.checked })
									}
								/>
								<Label
									htmlFor="thumbnail-ready"
									className="text-sm text-muted-foreground font-normal"
								>
									Thumbnail ready
								</Label>
							</div>
						</div>

						<div className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="vod-date" className="text-sm">
									VOD Date
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											id="vod-date"
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
								<Label htmlFor="release-date" className="text-sm">
									Release Date
								</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											id="release-date"
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
						</div>
					</div>

					{/* Owner, Channel Row */}
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label htmlFor="owner" className="text-sm">
								Owner
							</Label>
							<Select
								value={draft.owner || undefined}
								onValueChange={(value) =>
									updateDraft({ owner: value as IdeaDraft["owner"] })
								}
							>
								<SelectTrigger id="owner">
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
							<Label htmlFor="channel" className="text-sm">
								Channel
							</Label>
							<Select
								value={draft.channel || undefined}
								onValueChange={(value) =>
									updateDraft({ channel: value as IdeaDraft["channel"] })
								}
							>
								<SelectTrigger id="channel">
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
							<Label htmlFor="label" className="text-sm">
								Priority
							</Label>
							<Select
								value={draft.label || undefined}
								onValueChange={(value) =>
									updateDraft({ label: value as IdeaDraft["label"] })
								}
							>
								<SelectTrigger id="label">
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
							<Label htmlFor="potential" className="text-sm">
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
								<SelectTrigger id="potential">
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
							<Label htmlFor="ad-read-tracker" className="text-sm">
								Ad Track Reader
							</Label>
							<Select
								value={draft.adReadTracker || undefined}
								onValueChange={(value) =>
									updateDraft({
										adReadTracker: value as IdeaDraft["adReadTracker"],
									})
								}
							>
								<SelectTrigger id="ad-read-tracker">
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

					{/* Unsponsored Toggle */}
					<div className="flex items-center gap-2">
						<Switch
							id="unsponsored"
							checked={draft.unsponsored}
							onChange={(e) => updateDraft({ unsponsored: e.target.checked })}
						/>
						<Label
							htmlFor="unsponsored"
							className="text-sm text-muted-foreground font-normal"
						>
							Unsponsored
						</Label>
					</div>

					{/* Notes */}
					<div className="space-y-1.5">
						<Label htmlFor="notes" className="text-sm">
							Notes
						</Label>
						<Textarea
							ref={notesRef}
							id="notes"
							defaultValue={draft.notes}
							onInput={debouncedSaveToAtom}
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
					<Button type="submit" disabled={isSubmitting} onClick={handleSubmit}>
						{isSubmitting ? (
							<>
								<SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
								{isUploading ? "Uploading…" : "Adding…"}
							</>
						) : (
							"Add Idea"
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
