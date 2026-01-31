import { Plus, SpinnerGap, Upload, X } from "@phosphor-icons/react";
import { ChevronDownIcon } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import type { Idea } from "./KanbanBoard";

interface EditIdeaModalProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
    isConvexStorageId(thumbnail) ? { storageId: thumbnail as Id<"_storage"> } : "skip",
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
}: EditIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailReady, setThumbnailReady] = useState(false);
  const [resources, setResources] = useState<string[]>([""]);
  const [status, setStatus] = useState<Idea["status"] | "">("");
  const [vodRecordingDate, setVodRecordingDate] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [owner, setOwner] = useState<Idea["owner"] | "">("");
  const [channel, setChannel] = useState<Idea["channel"] | "">("");
  const [potential, setPotential] = useState<Idea["potential"] | "">("");
  const [label, setLabel] = useState<Idea["label"] | "">("");
  const [adReadTracker, setAdReadTracker] = useState<Idea["adReadTracker"] | "">("");
  const [unsponsored, setUnsponsored] = useState(true);
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

  const updateIdea = useMutation(api.ideas.update);

  useEffect(() => {
    if (idea && open) {
      setTitle(idea.title);
      setDescription(idea.description || "");
      setNotes(idea.notes || "");
      setThumbnailUrl(idea.thumbnail || "");
      setThumbnailReady(idea.thumbnailReady ?? false);
      setResources(idea.resources?.length ? idea.resources : [""]);
      setStatus(idea.status || "idea");
      setVodRecordingDate(idea.vodRecordingDate || "");
      setReleaseDate(idea.releaseDate || "");
      setOwner(idea.owner || "");
      setChannel(idea.channel || "");
      setPotential(typeof idea.potential === "number" ? idea.potential : "");
      setLabel(idea.label || "");
      setAdReadTracker(idea.adReadTracker || "");
      setUnsponsored(idea.unsponsored ?? true);
      clearFileUpload();
    }
  }, [idea, open, clearFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    setThumbnailUrl("");
    setThumbnailReady(true);
  };

  const updateResource = (index: number, value: string) => {
    setResources((prev) =>
      prev.map((resource, resourceIndex) =>
        resourceIndex === index ? value : resource,
      ),
    );
  };

  const addResource = () => {
    setResources((prev) => [...prev, ""]);
  };

  const removeResource = (index: number) => {
    setResources((prev) => {
      const nextResources = prev.filter((_, resourceIndex) => resourceIndex !== index);
      return nextResources.length ? nextResources : [""];
    });
  };

  const clearThumbnail = () => {
    clearFileUpload();
    setThumbnailUrl("");
    setThumbnailReady(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const trimmedThumbnailUrl = thumbnailUrl.trim();
      const wantsClear =
        !thumbnailFile &&
        !trimmedThumbnailUrl &&
        !thumbnailPreview &&
        Boolean(idea.thumbnail);
      let finalThumbnail: string | undefined = trimmedThumbnailUrl || undefined;

      if (thumbnailFile) {
        finalThumbnail = (await uploadFile()) ?? undefined;
      }

      const finalThumbnailReady = thumbnailReady || Boolean(finalThumbnail);

      await updateIdea({
        id: idea._id,
        title: title.trim(),
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        thumbnail: finalThumbnail,
        clearThumbnail: wantsClear ? true : undefined,
        thumbnailReady: finalThumbnailReady,
        resources: resources.filter((r) => r.trim()),
        status: status || "idea",
        vodRecordingDate: vodRecordingDate || undefined,
        releaseDate: releaseDate || undefined,
        owner: owner || undefined,
        channel: channel || undefined,
        potential: typeof potential === "number" ? potential : undefined,
        label: label || undefined,
        adReadTracker: adReadTracker || undefined,
        unsponsored,
      });

      toast.success("Idea updated successfully");
      onOpenChange(false);
    } catch (error) {
      void error;
      toast.error("Failed to update idea. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentThumbnail =
    thumbnailPreview || (thumbnailUrl && !thumbnailFile ? thumbnailUrl : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the hook?"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description" className="text-sm">
                Description
              </Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
              {resources.map((resource, index) => (
                <div key={`resource-${index}`} className="flex items-center gap-2">
                  <Input
                    id={index === 0 ? "edit-resources" : undefined}
                    type="url"
                    value={resource}
                    onChange={(e) => updateResource(index, e.target.value)}
                    placeholder={index === 0 ? "Add resource URL" : "Another resource URL"}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeResource(index)}
                    disabled={resources.length === 1 && !resource}
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
              {currentThumbnail ? (
                <div className="group relative rounded-lg overflow-hidden border border-border/40 aspect-video w-48 bg-muted/30">
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ThumbnailPreview thumbnail={thumbnailUrl} />
                  )}
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
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => {
                      setThumbnailUrl(e.target.value);
                      clearFileUpload();
                      setThumbnailReady(Boolean(e.target.value));
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
                    <Upload className="w-4 h-4" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  id="edit-thumbnail-ready"
                  checked={thumbnailReady}
                  onChange={(e) => setThumbnailReady(e.target.checked)}
                />
                <Label htmlFor="edit-thumbnail-ready" className="text-sm text-muted-foreground font-normal">
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
                      data-empty={!vodRecordingDate}
                      className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {formatDateValue(vodRecordingDate)}
                      <ChevronDownIcon className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDateValue(vodRecordingDate)}
                      onSelect={(date) =>
                        setVodRecordingDate(date ? format(date, "yyyy-MM-dd") : "")
                      }
                      defaultMonth={parseDateValue(vodRecordingDate)}
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
                      data-empty={!releaseDate}
                      className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
                    >
                      {formatDateValue(releaseDate)}
                      <ChevronDownIcon className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={parseDateValue(releaseDate)}
                      onSelect={(date) =>
                        setReleaseDate(date ? format(date, "yyyy-MM-dd") : "")
                      }
                      defaultMonth={parseDateValue(releaseDate)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* Status, Owner, Channel Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-status" className="text-sm">
                Status
              </Label>
              <Select
                value={status || undefined}
                onValueChange={(value) => setStatus(value as Idea["status"])}
              >
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="To Stream">To Stream</SelectItem>
                  <SelectItem value="Recorded">Recorded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-owner" className="text-sm">
                Owner
              </Label>
              <Select
                value={owner || undefined}
                onValueChange={(value) => setOwner(value as Idea["owner"])}
              >
                <SelectTrigger id="edit-owner">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Theo">Theo</SelectItem>
                  <SelectItem value="Phase">Phase</SelectItem>
                  <SelectItem value="Ben">Ben</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-channel" className="text-sm">
                Channel
              </Label>
              <Select
                value={channel || undefined}
                onValueChange={(value) => setChannel(value as Idea["channel"])}
              >
                <SelectTrigger id="edit-channel">
                  <SelectValue placeholder="Not set" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main</SelectItem>
                  <SelectItem value="theo rants">Theo Rants</SelectItem>
                  <SelectItem value="theo throwaways">Theo Throwaways</SelectItem>
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
                value={label || undefined}
                onValueChange={(value) => setLabel(value as Idea["label"])}
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
                value={potential !== "" ? String(potential) : undefined}
                onValueChange={(value) => setPotential(Number(value))}
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
                value={adReadTracker || undefined}
                onValueChange={(value) => setAdReadTracker(value as Idea["adReadTracker"])}
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

          {/* Unsponsored Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="edit-unsponsored"
              checked={unsponsored}
              onChange={(e) => setUnsponsored(e.target.checked)}
            />
            <Label htmlFor="edit-unsponsored" className="text-sm text-muted-foreground font-normal">
              Unsponsored
            </Label>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes" className="text-sm">
              Notes
            </Label>
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Loose thoughts, beats, punchlines…"
              className="min-h-[120px] resize-none"
            />
          </div>

        </form>

        <DialogFooter className="px-6 py-4 border-t border-border/40">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
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
