import {
  CaretDownIcon,
  MinusIcon,
  PlusIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { format, isValid, parseISO } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useState } from "react";
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
import {
  defaultIdeaDraft,
  newIdeaAdReadTrackerAtom,
  newIdeaChannelAtom,
  newIdeaDescriptionAtom,
  newIdeaDraftAtom,
  newIdeaLabelAtom,
  newIdeaNotesAtom,
  newIdeaOwnerAtom,
  newIdeaPotentialAtom,
  newIdeaReleaseDateAtom,
  newIdeaResourcesAtom,
  newIdeaThumbnailAtom,
  newIdeaThumbnailReadyAtom,
  newIdeaTitleAtom,
  newIdeaUnsponsoredAtom,
  newIdeaVodRecordingDateAtom,
  streamModeAtom,
} from "@/store/atoms";

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

// Isolated field components to prevent re-renders
const TitleField = memo(function TitleField() {
  const [title, setTitle] = useAtom(newIdeaTitleAtom);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="title" className="text-sm">
        Title <span className="text-destructive">*</span>
      </Label>
      <Input
        id="title"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's the hook?"
        autoFocus
      />
    </div>
  );
});

const DescriptionField = memo(function DescriptionField() {
  const [description, setDescription] = useAtom(newIdeaDescriptionAtom);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="description" className="text-sm">
        Description
      </Label>
      <Input
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="One-line summary"
      />
    </div>
  );
});

const ResourcesSection = memo(function ResourcesSection() {
  const [resources, setResources] = useAtom(newIdeaResourcesAtom);
  const resourceList = resources.length ? resources : [""];

  const updateResource = (index: number, value: string) => {
    const next = resources.length ? [...resources] : [""];
    next[index] = value;
    setResources(next);
  };

  const addResource = () => {
    setResources([...(resources.length ? resources : [""]), ""]);
  };

  const removeResource = (index: number) => {
    if (resources.length <= 1) {
      setResources([""]);
      return;
    }
    const next = resources.filter((_, i) => i !== index);
    setResources(next.length ? next : [""]);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="resources" className="text-sm">
        Resources
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {resourceList.map((resource, index) => (
          <div key={`resource-${index}`} className="flex items-center gap-2">
            <Input
              id={index === 0 ? "resources" : undefined}
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
              disabled={resourceList.length === 1 && resourceList[0]?.length === 0}
              aria-label="Remove resource"
            >
              <MinusIcon className="w-4 h-4" />
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
  );
});

interface ThumbnailSectionProps {
  thumbnailFile: File | null;
  thumbnailPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}

const ThumbnailSection = memo(function ThumbnailSection({
  thumbnailPreview,
  fileInputRef,
  onFileSelect,
  onClear,
}: ThumbnailSectionProps) {
  const [thumbnail, setThumbnail] = useAtom(newIdeaThumbnailAtom);
  const [thumbnailReady, setThumbnailReady] = useAtom(newIdeaThumbnailReadyAtom);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    setThumbnail("");
    setThumbnailReady(true);
  };

  const clearThumbnail = () => {
    onClear();
    setThumbnail("");
    setThumbnailReady(false);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Thumbnail</Label>
      {thumbnailPreview ? (
        <div className="group relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-muted/30">
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
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="url"
            value={thumbnail}
            onChange={(e) => setThumbnail(e.target.value)}
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
          id="thumbnail-ready"
          checked={thumbnailReady}
          onChange={(e) => setThumbnailReady(e.target.checked)}
        />
        <Label htmlFor="thumbnail-ready" className="text-sm text-muted-foreground font-normal">
          Thumbnail ready
        </Label>
      </div>
    </div>
  );
});

const DatesSection = memo(function DatesSection() {
  const [vodRecordingDate, setVodRecordingDate] = useAtom(newIdeaVodRecordingDateAtom);
  const [releaseDate, setReleaseDate] = useAtom(newIdeaReleaseDateAtom);

  return (
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
              data-empty={!vodRecordingDate}
              className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
            >
              {formatDateValue(vodRecordingDate)}
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDateValue(vodRecordingDate)}
              onSelect={(date) => setVodRecordingDate(date ? format(date, "yyyy-MM-dd") : "")}
              defaultMonth={parseDateValue(vodRecordingDate)}
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
              data-empty={!releaseDate}
              className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
            >
              {formatDateValue(releaseDate)}
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDateValue(releaseDate)}
              onSelect={(date) => setReleaseDate(date ? format(date, "yyyy-MM-dd") : "")}
              defaultMonth={parseDateValue(releaseDate)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});

const OwnerChannelSection = memo(function OwnerChannelSection() {
  const [owner, setOwner] = useAtom(newIdeaOwnerAtom);
  const [channel, setChannel] = useAtom(newIdeaChannelAtom);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="owner" className="text-sm">
          Owner
        </Label>
        <Select
          value={owner || undefined}
          onValueChange={(value) => setOwner(value as typeof owner)}
        >
          <SelectTrigger id="owner">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Theo">Theo</SelectItem>
            <SelectItem value="Phase">Phase</SelectItem>
            <SelectItem value="Mir">Mir</SelectItem>
            <SelectItem value="flip">flip</SelectItem>
            <SelectItem value="melkey">melkey</SelectItem>
            <SelectItem value="gabriel">gabriel</SelectItem>
            <SelectItem value="ben">ben</SelectItem>
            <SelectItem value="shivam">shivam</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="channel" className="text-sm">
          Channel
        </Label>
        <Select
          value={channel || undefined}
          onValueChange={(value) => setChannel(value as typeof channel)}
        >
          <SelectTrigger id="channel">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="C:Main">Main</SelectItem>
            <SelectItem value="C:Rants">Rants</SelectItem>
            <SelectItem value="C:Throwaways">Throwaways</SelectItem>
            <SelectItem value="C:Other">Other</SelectItem>
            <SelectItem value="C:Main(SHORT)">Main (SHORT)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

const LabelSection = memo(function LabelSection() {
  const [label, setLabel] = useAtom(newIdeaLabelAtom);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="label" className="text-sm">
        Label
      </Label>
      <Select value={label || undefined} onValueChange={(value) => setLabel(value as typeof label)}>
        <SelectTrigger id="label">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="Priority">Priority</SelectItem>
          <SelectItem value="Mid Priority">Mid Priority</SelectItem>
          <SelectItem value="Requires Planning">Requires Planning</SelectItem>
          <SelectItem value="Strict deadline">Strict deadline</SelectItem>
          <SelectItem value="Sponsored">Sponsored</SelectItem>
          <SelectItem value="High Effort">High Effort</SelectItem>
          <SelectItem value="Worth it?">Worth it?</SelectItem>
          <SelectItem value="Evergreen">Evergreen</SelectItem>
          <SelectItem value="Database Week">Database Week</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
});

const PotentialAdReadSection = memo(function PotentialAdReadSection() {
  const [potential, setPotential] = useAtom(newIdeaPotentialAtom);
  const [adReadTracker, setAdReadTracker] = useAtom(newIdeaAdReadTrackerAtom);
  const streamMode = useAtomValue(streamModeAtom);

  return (
    <div className={`grid gap-4 ${streamMode ? "grid-cols-1" : "grid-cols-2"}`}>
      <div className="space-y-1.5">
        <Label htmlFor="potential" className="text-sm">
          Potential
        </Label>
        <Select
          value={potential !== "" ? String(potential) : undefined}
          onValueChange={(value) => setPotential(Number(value))}
        >
          <SelectTrigger id="potential">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!streamMode && (
        <div className="space-y-1.5 opacity-50">
          <Label htmlFor="ad-read-tracker" className="text-sm">
            Ad Read Tracker
          </Label>
          <Select
            value={adReadTracker || undefined}
            onValueChange={(value) => setAdReadTracker(value as typeof adReadTracker)}
            disabled
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
      )}
    </div>
  );
});

const UnsponsoredToggle = memo(function UnsponsoredToggle() {
  const [unsponsored, setUnsponsored] = useAtom(newIdeaUnsponsoredAtom);
  const streamMode = useAtomValue(streamModeAtom);

  if (streamMode) return null;

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="unsponsored"
        checked={unsponsored}
        onChange={(e) => setUnsponsored(e.target.checked)}
      />
      <Label htmlFor="unsponsored" className="text-sm text-muted-foreground font-normal">
        Unsponsored
      </Label>
    </div>
  );
});

const NotesField = memo(function NotesField() {
  const [notes, setNotes] = useAtom(newIdeaNotesAtom);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="notes" className="text-sm">
        Notes
      </Label>
      <Textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Loose thoughts, beats, punchlines…"
        className="min-h-[120px] resize-none"
      />
    </div>
  );
});

export function AddIdeaModal({ open, onOpenChange, organizationId }: AddIdeaModalProps) {
  const title = useAtomValue(newIdeaTitleAtom);
  const description = useAtomValue(newIdeaDescriptionAtom);
  const notes = useAtomValue(newIdeaNotesAtom);
  const thumbnail = useAtomValue(newIdeaThumbnailAtom);
  const thumbnailReady = useAtomValue(newIdeaThumbnailReadyAtom);
  const resources = useAtomValue(newIdeaResourcesAtom);
  const vodRecordingDate = useAtomValue(newIdeaVodRecordingDateAtom);
  const releaseDate = useAtomValue(newIdeaReleaseDateAtom);
  const owner = useAtomValue(newIdeaOwnerAtom);
  const channel = useAtomValue(newIdeaChannelAtom);
  const potential = useAtomValue(newIdeaPotentialAtom);
  const label = useAtomValue(newIdeaLabelAtom);
  const adReadTracker = useAtomValue(newIdeaAdReadTrackerAtom);
  const unsponsored = useAtomValue(newIdeaUnsponsoredAtom);
  const setNewDraft = useSetAtom(newIdeaDraftAtom);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const resourceList = resources.length ? resources : [""];

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

  const clearAll = () => {
    setNewDraft(defaultIdeaDraft);
    clearFileUpload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setIsSubmitting(true);
    try {
      const trimmedDescription = description.trim();
      const trimmedNotes = notes.trim();
      const trimmedThumbnail = thumbnail.trim();
      const cleanedResources = resourceList.map((resource) => resource.trim()).filter(Boolean);

      let finalThumbnail: string | undefined;
      if (thumbnailFile) {
        finalThumbnail = (await uploadFile()) ?? undefined;
      } else if (trimmedThumbnail) {
        finalThumbnail = trimmedThumbnail;
      }

      await createIdea({
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        notes: trimmedNotes || undefined,
        thumbnail: finalThumbnail,
        thumbnailReady: thumbnailReady || Boolean(finalThumbnail),
        resources: cleanedResources,
        vodRecordingDate: vodRecordingDate || undefined,
        releaseDate: releaseDate || undefined,
        owner: owner || undefined,
        channel: channel || undefined,
        potential: typeof potential === "number" ? potential : undefined,
        label: label || undefined,
        adReadTracker: adReadTracker || undefined,
        unsponsored,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <DialogHeader className="sr-only">
          <DialogTitle>Add Idea</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Title & Description */}
          <div className="space-y-4">
            <TitleField />
            <DescriptionField />
          </div>

          {/* Resources */}
          <ResourcesSection />

          {/* Thumbnail + Dates */}
          <div className="grid grid-cols-2 gap-4">
            <ThumbnailSection
              thumbnailFile={thumbnailFile}
              thumbnailPreview={thumbnailPreview}
              fileInputRef={fileInputRef}
              onFileSelect={onFileSelect}
              onClear={clearFileUpload}
            />
            <DatesSection />
          </div>

          {/* Owner, Channel Row */}
          <OwnerChannelSection />

          {/* Label */}
          <LabelSection />

          {/* Potential Row + Ad Track Reader */}
          <PotentialAdReadSection />

          {/* Unsponsored Toggle */}
          <UnsponsoredToggle />

          {/* Notes */}
          <NotesField />
        </form>

        <DialogFooter className="px-6 py-4 border-t border-border/40">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? (
              <>
                <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
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
