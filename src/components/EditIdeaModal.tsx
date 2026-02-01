import { useConvexMutation } from "@convex-dev/react-query";
import {
  CaretDownIcon,
  CheckIcon,
  MinusIcon,
  PencilSimpleIcon,
  PlusIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { format, isValid, parseISO } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import { memo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  editIdeaAdReadTrackerAtom,
  editIdeaChannelAtom,
  editIdeaDescriptionAtom,
  editIdeaIdFieldAtom,
  editIdeaIsEditingAtom,
  editIdeaLabelAtom,
  editIdeaNotesAtom,
  editIdeaOwnerAtom,
  editIdeaPotentialAtom,
  editIdeaReleaseDateAtom,
  editIdeaResourcesAtom,
  editIdeaStatusAtom,
  editIdeaThumbnailAtom,
  editIdeaThumbnailReadyAtom,
  editIdeaTitleAtom,
  editIdeaUnsponsoredAtom,
  editIdeaVodRecordingDateAtom,
  streamModeAtom,
} from "@/store/atoms";
import { IdeaPreview } from "./IdeaPreview";
import type { Idea } from "./KanbanBoard";
import { Badge } from "./ui/badge";

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
    isConvexStorageId(thumbnail) ? { storageId: thumbnail as Id<"_storage"> } : "skip",
  );
  const imageUrl = isConvexStorageId(thumbnail) ? storageUrl : thumbnail;

  if (!imageUrl) return null;
  return <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />;
}

// Hook to share update logic across field components
function useScheduledUpdate(organizationId?: string) {
  const ideaId = useAtomValue(editIdeaIdFieldAtom);
  const {
    mutate: updateIdea,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: useConvexMutation(api.ideas.update),
  });
  const pendingUpdatesRef = useRef<Record<string, unknown>>({});

  const debouncedCommit = useDebouncedCallback(() => {
    if (!ideaId) return;
    const payload = pendingUpdatesRef.current;
    pendingUpdatesRef.current = {};
    if (!Object.keys(payload).length) return;
    void updateIdea({
      id: ideaId,
      ...payload,
      organizationId,
    });
  }, 750);

  const scheduleUpdate = (updates: Record<string, unknown>) => {
    pendingUpdatesRef.current = {
      ...pendingUpdatesRef.current,
      ...updates,
    };
    debouncedCommit();
  };

  return { scheduleUpdate, isPending, isSuccess };
}

// Isolated field components
interface FieldProps {
  scheduleUpdate: (updates: Record<string, unknown>) => void;
}

const TitleField = memo(function TitleField({ scheduleUpdate }: FieldProps) {
  const [title, setTitle] = useAtom(editIdeaTitleAtom);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-title" className="text-sm">
        Title <span className="text-destructive">*</span>
      </Label>
      <Input
        id="edit-title"
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleUpdate({ title: e.target.value });
        }}
        placeholder="What's the hook?"
      />
    </div>
  );
});

const DescriptionField = memo(function DescriptionField({ scheduleUpdate }: FieldProps) {
  const [description, setDescription] = useAtom(editIdeaDescriptionAtom);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-description" className="text-sm">
        Description
      </Label>
      <Input
        id="edit-description"
        value={description}
        onChange={(e) => {
          setDescription(e.target.value);
          scheduleUpdate({ description: e.target.value });
        }}
        placeholder="One-line summary"
      />
    </div>
  );
});

const ResourcesSection = memo(function ResourcesSection({ scheduleUpdate }: FieldProps) {
  const [resources, setResources] = useAtom(editIdeaResourcesAtom);
  const resourceList = resources.length ? resources : [""];

  const updateResource = (index: number, value: string) => {
    const next = resources.length ? [...resources] : [""];
    next[index] = value;
    setResources(next);
    scheduleUpdate({ resources: next });
  };

  const addResource = () => {
    const next = [...(resources.length ? resources : [""]), ""];
    setResources(next);
    scheduleUpdate({ resources: next });
  };

  const removeResource = (index: number) => {
    if (resources.length <= 1) {
      const next = [""];
      setResources(next);
      scheduleUpdate({ resources: next });
      return;
    }
    const next = resources.filter((_, i) => i !== index);
    const normalized = next.length ? next : [""];
    setResources(normalized);
    scheduleUpdate({ resources: normalized });
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-resources" className="text-sm">
        Resources
      </Label>
      <div className="grid grid-cols-2 gap-2">
        {resourceList.map((resource, index) => (
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

interface ThumbnailSectionProps extends FieldProps {
  thumbnailPreview: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  uploadFile: () => Promise<string | null>;
}

const ThumbnailSection = memo(function ThumbnailSection({
  scheduleUpdate,
  thumbnailPreview,
  fileInputRef,
  onFileSelect,
  onClear,
  uploadFile,
}: ThumbnailSectionProps) {
  const [thumbnail, setThumbnail] = useAtom(editIdeaThumbnailAtom);
  const [thumbnailReady, setThumbnailReady] = useAtom(editIdeaThumbnailReadyAtom);

  const currentThumbnail = thumbnailPreview || (thumbnail ? thumbnail : null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    setThumbnail("");
    setThumbnailReady(true);
    scheduleUpdate({ thumbnail: "", thumbnailReady: true });
    void (async () => {
      try {
        const storageId = await uploadFile();
        if (!storageId) return;
        setThumbnail(storageId);
        setThumbnailReady(true);
        scheduleUpdate({ thumbnail: storageId, thumbnailReady: true });
      } catch (error) {
        void error;
      }
    })();
  };

  const clearThumbnail = () => {
    onClear();
    setThumbnail("");
    setThumbnailReady(false);
    scheduleUpdate({ thumbnail: "", thumbnailReady: false });
  };

  return (
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
            <ThumbnailPreview thumbnail={thumbnail} />
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
            value={thumbnail}
            onChange={(e) => {
              setThumbnail(e.target.value);
              scheduleUpdate({ thumbnail: e.target.value });
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
          checked={thumbnailReady}
          onChange={(e) => {
            setThumbnailReady(e.target.checked);
            scheduleUpdate({ thumbnailReady: e.target.checked });
          }}
        />
        <Label htmlFor="edit-thumbnail-ready" className="text-sm text-muted-foreground font-normal">
          Thumbnail ready
        </Label>
      </div>
    </div>
  );
});

const DatesSection = memo(function DatesSection({ scheduleUpdate }: FieldProps) {
  const [vodRecordingDate, setVodRecordingDate] = useAtom(editIdeaVodRecordingDateAtom);
  const [releaseDate, setReleaseDate] = useAtom(editIdeaReleaseDateAtom);

  return (
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
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDateValue(vodRecordingDate)}
              onSelect={(date) => {
                const next = date ? format(date, "yyyy-MM-dd") : "";
                setVodRecordingDate(next);
                scheduleUpdate({ vodRecordingDate: next });
              }}
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
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={parseDateValue(releaseDate)}
              onSelect={(date) => {
                const next = date ? format(date, "yyyy-MM-dd") : "";
                setReleaseDate(next);
                scheduleUpdate({ releaseDate: next });
              }}
              defaultMonth={parseDateValue(releaseDate)}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
});

const UnsponsoredSection = memo(function UnsponsoredSection({ scheduleUpdate }: FieldProps) {
  const [unsponsored, setUnsponsored] = useAtom(editIdeaUnsponsoredAtom);
  const streamMode = useAtomValue(streamModeAtom);

  if (streamMode) return null;

  return (
    <div className="flex items-center gap-2 pt-1">
      <Switch
        id="edit-unsponsored"
        checked={unsponsored}
        onChange={(e) => {
          setUnsponsored(e.target.checked);
          scheduleUpdate({ unsponsored: e.target.checked });
        }}
      />
      <Label htmlFor="edit-unsponsored" className="text-sm text-muted-foreground font-normal">
        Unsponsored
      </Label>
    </div>
  );
});

const OwnerChannelSection = memo(function OwnerChannelSection({ scheduleUpdate }: FieldProps) {
  const [owner, setOwner] = useAtom(editIdeaOwnerAtom);
  const [channel, setChannel] = useAtom(editIdeaChannelAtom);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-owner" className="text-sm">
          Owner
        </Label>
        <Select
          value={owner || undefined}
          onValueChange={(value) => {
            const nextValue = (value || "") as typeof owner;
            setOwner(nextValue);
            scheduleUpdate({ owner: value || undefined });
          }}
        >
          <SelectTrigger id="edit-owner">
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
        <Label htmlFor="edit-channel" className="text-sm">
          Channel
        </Label>
        <Select
          value={channel || undefined}
          onValueChange={(value) => {
            const nextValue = (value || "") as typeof channel;
            setChannel(nextValue);
            scheduleUpdate({ channel: value || undefined });
          }}
        >
          <SelectTrigger id="edit-channel">
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

const LabelStatusSection = memo(function LabelStatusSection({ scheduleUpdate }: FieldProps) {
  const [label, setLabel] = useAtom(editIdeaLabelAtom);
  const [status, setStatus] = useAtom(editIdeaStatusAtom);

  const handleStatusChange = (value: string) => {
    const nextValue = (value || "") as typeof status;
    setStatus(nextValue);

    // Sync column based on status
    if (value === "To Stream") {
      scheduleUpdate({ status: value, column: "To Stream" });
    } else {
      scheduleUpdate({ status: value || undefined, column: "Concept" });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-label" className="text-sm">
          Label
        </Label>
        <Select
          value={label || undefined}
          onValueChange={(value) => {
            const nextValue = (value || "") as typeof label;
            setLabel(nextValue);
            scheduleUpdate({ label: value || undefined });
          }}
        >
          <SelectTrigger id="edit-label">
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
      <div className="space-y-1.5">
        <Label htmlFor="edit-status" className="text-sm">
          Status
        </Label>
        <Select value={status || undefined} onValueChange={handleStatusChange}>
          <SelectTrigger id="edit-status">
            <SelectValue placeholder="Not set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Concept">Concept</SelectItem>
            <SelectItem value="To Stream">To Stream</SelectItem>
            <SelectItem value="Recorded">Recorded</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

const PotentialAdReadSection = memo(function PotentialAdReadSection({
  scheduleUpdate,
}: FieldProps) {
  const [potential, setPotential] = useAtom(editIdeaPotentialAtom);
  const [adReadTracker, setAdReadTracker] = useAtom(editIdeaAdReadTrackerAtom);
  const streamMode = useAtomValue(streamModeAtom);

  return (
    <div className={`grid gap-4 ${streamMode ? "grid-cols-1" : "grid-cols-2"}`}>
      <div className="space-y-1.5">
        <Label htmlFor="edit-potential" className="text-sm">
          Potential
        </Label>
        <Select
          value={potential !== "" ? String(potential) : undefined}
          onValueChange={(value) => {
            const next = Number(value);
            setPotential(next);
            scheduleUpdate({ potential: next });
          }}
        >
          <SelectTrigger id="edit-potential">
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
          <Label htmlFor="edit-ad-read-tracker" className="text-sm">
            Ad Read Tracker
          </Label>
          <Select
            value={adReadTracker || undefined}
            onValueChange={(value) => {
              const nextValue = (value || "") as typeof adReadTracker;
              setAdReadTracker(nextValue);
              scheduleUpdate({ adReadTracker: value || undefined });
            }}
            disabled
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
      )}
    </div>
  );
});

const NotesField = memo(function NotesField({ scheduleUpdate }: FieldProps) {
  const [notes, setNotes] = useAtom(editIdeaNotesAtom);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="edit-notes" className="text-sm">
        Notes
      </Label>
      <Textarea
        id="edit-notes"
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          scheduleUpdate({ notes: e.target.value });
        }}
        placeholder="Loose thoughts, beats, punchlines…"
        className="min-h-[120px] resize-none"
      />
    </div>
  );
});

export function EditIdeaModal({ open, onOpenChange, organizationId }: EditIdeaModalProps) {
  const [isEditing, setIsEditing] = useAtom(editIdeaIsEditingAtom);
  const title = useAtomValue(editIdeaTitleAtom);
  const description = useAtomValue(editIdeaDescriptionAtom);
  const notes = useAtomValue(editIdeaNotesAtom);
  const thumbnail = useAtomValue(editIdeaThumbnailAtom);
  const thumbnailReady = useAtomValue(editIdeaThumbnailReadyAtom);
  const resources = useAtomValue(editIdeaResourcesAtom);
  const vodRecordingDate = useAtomValue(editIdeaVodRecordingDateAtom);
  const releaseDate = useAtomValue(editIdeaReleaseDateAtom);
  const owner = useAtomValue(editIdeaOwnerAtom);
  const channel = useAtomValue(editIdeaChannelAtom);
  const potential = useAtomValue(editIdeaPotentialAtom);
  const label = useAtomValue(editIdeaLabelAtom);
  const status = useAtomValue(editIdeaStatusAtom);
  const adReadTracker = useAtomValue(editIdeaAdReadTrackerAtom);
  const unsponsored = useAtomValue(editIdeaUnsponsoredAtom);
  const streamMode = useAtomValue(streamModeAtom);
  const resourceList = resources.length ? resources : [""];

  const { scheduleUpdate, isPending, isSuccess } = useScheduledUpdate(organizationId);

  const {
    preview: thumbnailPreview,
    fileInputRef,
    handleFileSelect: onFileSelect,
    upload: uploadFile,
    clear: clearFileUpload,
  } = useFileUpload();

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearFileUpload();
      setIsEditing(false);
    }
    onOpenChange(nextOpen);
  };

  const handleEditToggle = () => {
    setIsEditing(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-medium text-muted-foreground">
              {isEditing ? "Edit Idea" : "Idea Details"}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleEditToggle}
                aria-label="Edit"
                className="cursor-pointer"
              >
                <PencilSimpleIcon weight="duotone" className="w-4 h-4" />
                Edit
              </Button>
            )}
            {isEditing && isPending && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <SpinnerIcon weight="bold" className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </div>
            )}
            {isSuccess && (
              <Badge variant="link" className="flex items-center gap-1.5 px-3 py-2 rounded-md">
                <CheckIcon weight="bold" className="w-4 h-4" />
                Saved
              </Badge>
            )}
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              size="icon"
              className="cursor-pointer border-none"
              aria-label="Close"
            >
              <XIcon weight="bold" className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {isEditing ? (
          <div className="px-6 py-5 space-y-5">
            {/* Title & Description */}
            <div className="space-y-4">
              <TitleField scheduleUpdate={scheduleUpdate} />
              <DescriptionField scheduleUpdate={scheduleUpdate} />
            </div>

            {/* Resources */}
            <ResourcesSection scheduleUpdate={scheduleUpdate} />

            {/* Thumbnail + Dates */}
            <div className="grid grid-cols-2 gap-4">
              <ThumbnailSection
                scheduleUpdate={scheduleUpdate}
                thumbnailPreview={thumbnailPreview}
                fileInputRef={fileInputRef}
                onFileSelect={onFileSelect}
                onClear={clearFileUpload}
                uploadFile={uploadFile}
              />
              <div className="space-y-4">
                <DatesSection scheduleUpdate={scheduleUpdate} />
                <UnsponsoredSection scheduleUpdate={scheduleUpdate} />
              </div>
            </div>

            {/* Owner, Channel Row */}
            <OwnerChannelSection scheduleUpdate={scheduleUpdate} />

            {/* Label, Status Row */}
            <LabelStatusSection scheduleUpdate={scheduleUpdate} />

            {/* Potential Row + Ad Track Reader */}
            <PotentialAdReadSection scheduleUpdate={scheduleUpdate} />

            {/* Notes */}
            <NotesField scheduleUpdate={scheduleUpdate} />
          </div>
        ) : (
          <IdeaPreview
            title={title}
            description={description}
            notes={notes}
            thumbnail={thumbnail}
            thumbnailPreview={thumbnailPreview}
            thumbnailReady={thumbnailReady}
            resources={resourceList}
            vodRecordingDate={vodRecordingDate}
            releaseDate={releaseDate}
            owner={owner}
            channel={channel}
            potential={potential}
            label={label}
            status={status}
            adReadTracker={adReadTracker}
            unsponsored={unsponsored}
            streamMode={streamMode}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
