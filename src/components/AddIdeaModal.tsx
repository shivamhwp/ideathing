import { CaretDownIcon, SpinnerIcon } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { format } from "date-fns";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useState } from "react";
import { channelValues, ownerValues } from "shared/idea-values";
import { toast } from "sonner";
import { formatDateValue, parseDateValue } from "@/components/idea-form/date-utils";
import {
  DescriptionField,
  LabelSelect,
  ResourcesSection,
  ThumbnailField,
  TitleField,
} from "@/components/idea-form/fields";
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
import { defaultIdeaDraft, newIdeaDraftAtom, newIdeaFields, streamModeAtom } from "@/store/atoms";

interface AddIdeaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DatesSection = memo(function DatesSection() {
  const [vodRecordingDate, setVodRecordingDate] = useAtom(newIdeaFields.vodRecordingDate);
  const [releaseDate, setReleaseDate] = useAtom(newIdeaFields.releaseDate);

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
  const [owner, setOwner] = useAtom(newIdeaFields.owner);
  const [channel, setChannel] = useAtom(newIdeaFields.channel);

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
  const [label, setLabel] = useAtom(newIdeaFields.label);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="label" className="text-sm">
        Label
      </Label>
      <LabelSelect id="label" labels={label} onChange={setLabel} />
    </div>
  );
});

const PotentialAdReadSection = memo(function PotentialAdReadSection() {
  const [potential, setPotential] = useAtom(newIdeaFields.potential);
  const [adReadTracker, setAdReadTracker] = useAtom(newIdeaFields.adReadTracker);
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
          <Input
            id="ad-read-tracker"
            value={adReadTracker ? "•••••" : ""}
            placeholder="Not set"
            disabled
            onChange={(event) => setAdReadTracker(event.target.value)}
          />
        </div>
      )}
    </div>
  );
});

const UnsponsoredToggle = memo(function UnsponsoredToggle() {
  const [unsponsored, setUnsponsored] = useAtom(newIdeaFields.unsponsored);
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

const NotesField = memo(function NotesField({ autoFocus = false }: { autoFocus?: boolean }) {
  const [notes, setNotes] = useAtom(newIdeaFields.notes);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="notes" className="text-sm">
        Notes
      </Label>
      <Textarea
        id="notes"
        autoFocus={autoFocus}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Loose thoughts, beats, punchlines…"
        className="min-h-[120px] resize-none"
      />
    </div>
  );
});

export function AddIdeaModal({ open, onOpenChange }: AddIdeaModalProps) {
  const [title, setTitle] = useAtom(newIdeaFields.title);
  const [description, setDescription] = useAtom(newIdeaFields.description);
  const notes = useAtomValue(newIdeaFields.notes);
  const [thumbnail, setThumbnail] = useAtom(newIdeaFields.draftThumbnail);
  const [thumbnailReady, setThumbnailReady] = useAtom(newIdeaFields.thumbnailReady);
  const [resources, setResources] = useAtom(newIdeaFields.resources);
  const vodRecordingDate = useAtomValue(newIdeaFields.vodRecordingDate);
  const releaseDate = useAtomValue(newIdeaFields.releaseDate);
  const owner = useAtomValue(newIdeaFields.owner);
  const channel = useAtomValue(newIdeaFields.channel);
  const potential = useAtomValue(newIdeaFields.potential);
  const label = useAtomValue(newIdeaFields.label);
  const adReadTracker = useAtomValue(newIdeaFields.adReadTracker);
  const unsponsored = useAtomValue(newIdeaFields.unsponsored);
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

  const createIdea = useMutation(api.ideas.mutations.create);

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
        description: trimmedDescription || "",
        notes: trimmedNotes || "",
        draftThumbnail: finalThumbnail,
        thumbnailReady: thumbnailReady || Boolean(finalThumbnail),
        resources: cleanedResources,
        vodRecordingDate: vodRecordingDate || undefined,
        releaseDate: releaseDate || undefined,
        owner: owner || ownerValues[7],
        channel: channel || channelValues[0],
        potential: typeof potential === "number" ? potential : undefined,
        label: label.length ? label : undefined,
        adReadTracker: adReadTracker || undefined,
        unsponsored,
      });

      toast.success("Idea added successfully");
      clearAll();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
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
            <TitleField autoFocus id="title" value={title} onChange={setTitle} />
            <DescriptionField id="description" value={description} onChange={setDescription} />
          </div>

          {/* Resources */}
          <ResourcesSection id="resources" resources={resources} onChange={setResources} />

          {/* Thumbnail + Dates */}
          <div className="grid grid-cols-2 gap-4">
            <ThumbnailField
              thumbnail={thumbnail}
              thumbnailReady={thumbnailReady}
              showPreview={Boolean(thumbnailPreview)}
              previewUrl={thumbnailPreview}
              fileInputRef={fileInputRef}
              onFileSelect={(event) => {
                onFileSelect(event);
                setThumbnail("");
                setThumbnailReady(true);
              }}
              onClear={() => {
                clearFileUpload();
                setThumbnail("");
                setThumbnailReady(false);
              }}
              onThumbnailChange={setThumbnail}
              onThumbnailReadyChange={setThumbnailReady}
              labelId="thumbnail-ready"
            />
            <DatesSection />
          </div>

          <OwnerChannelSection />
          <LabelSection />
          <PotentialAdReadSection />
          <UnsponsoredToggle />
          <NotesField autoFocus />
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
