import { useConvexMutation } from "@convex-dev/react-query";
import {
  CaretDownIcon,
  CheckIcon,
  PencilSimpleIcon,
  SpinnerIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useMutation } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import type { ChangeEvent, RefObject } from "react";
import { memo, useRef } from "react";
import { useDebouncedCallback } from "use-debounce";
import { formatDateValue, parseDateValue } from "@/components/idea-form/date-utils";
import {
  DescriptionField as IdeaDescriptionField,
  LabelSelect,
  ResourcesSection as IdeaResourcesSection,
  ThumbnailField as IdeaThumbnailField,
  TitleField as IdeaTitleField,
} from "@/components/idea-form/fields";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { editIdeaFields, editIdeaIsEditingAtom, streamModeAtom } from "@/store/atoms";
import { IdeaPreview } from "./IdeaPreview";
import type { Idea } from "./KanbanBoard";
import { Badge } from "./ui/badge";

interface EditIdeaModalProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Hook to share update logic across field components
function useScheduledUpdate() {
  const ideaId = useAtomValue(editIdeaFields.ideaId);
  const {
    mutate: updateIdea,
    isPending,
    isSuccess,
  } = useMutation({
    mutationFn: useConvexMutation(api.ideas.mutations.update),
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
  const [title, setTitle] = useAtom(editIdeaFields.title);
  return (
    <IdeaTitleField
      id="edit-title"
      value={title}
      onChange={(next) => {
        setTitle(next);
        scheduleUpdate({ title: next });
      }}
    />
  );
});

const DescriptionField = memo(function DescriptionField({ scheduleUpdate }: FieldProps) {
  const [description, setDescription] = useAtom(editIdeaFields.description);
  return (
    <IdeaDescriptionField
      id="edit-description"
      value={description}
      onChange={(next) => {
        setDescription(next);
        scheduleUpdate({ description: next });
      }}
    />
  );
});

const ResourcesSection = memo(function ResourcesSection({ scheduleUpdate }: FieldProps) {
  const [resources, setResources] = useAtom(editIdeaFields.resources);
  return (
    <IdeaResourcesSection
      id="edit-resources"
      resources={resources}
      onChange={(next) => {
        setResources(next);
        scheduleUpdate({ resources: next });
      }}
    />
  );
});

interface ThumbnailSectionProps extends FieldProps {
  thumbnailPreview: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
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
  const [thumbnail, setThumbnail] = useAtom(editIdeaFields.draftThumbnail);
  const [thumbnailReady, setThumbnailReady] = useAtom(editIdeaFields.thumbnailReady);

  const hasThumbnail = Boolean(thumbnailPreview || thumbnail);
  const previewUrl = thumbnailPreview || thumbnail || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileSelect(e);
    setThumbnail("");
    setThumbnailReady(true);
    scheduleUpdate({ draftThumbnail: "", thumbnailReady: true });
    void (async () => {
      try {
        const storageId = await uploadFile();
        if (!storageId) return;
        setThumbnail(storageId);
        setThumbnailReady(true);
        scheduleUpdate({ draftThumbnail: storageId, thumbnailReady: true });
      } catch (error) {
        void error;
      }
    })();
  };

  const clearThumbnail = () => {
    onClear();
    setThumbnail("");
    setThumbnailReady(false);
    scheduleUpdate({ draftThumbnail: "", thumbnailReady: false });
  };

  return (
    <IdeaThumbnailField
      labelId="edit-thumbnail-ready"
      thumbnail={thumbnail}
      thumbnailReady={thumbnailReady}
      showPreview={hasThumbnail}
      previewUrl={previewUrl}
      fileInputRef={fileInputRef}
      onFileSelect={handleFileSelect}
      onClear={clearThumbnail}
      onThumbnailChange={(next) => {
        setThumbnail(next);
        scheduleUpdate({ draftThumbnail: next });
      }}
      onThumbnailReadyChange={(next) => {
        setThumbnailReady(next);
        scheduleUpdate({ thumbnailReady: next });
      }}
    />
  );
});

const DatesSection = memo(function DatesSection({ scheduleUpdate }: FieldProps) {
  const [vodRecordingDate, setVodRecordingDate] = useAtom(editIdeaFields.vodRecordingDate);
  const [releaseDate, setReleaseDate] = useAtom(editIdeaFields.releaseDate);

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
  const [unsponsored, setUnsponsored] = useAtom(editIdeaFields.unsponsored);
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
  const [owner, setOwner] = useAtom(editIdeaFields.owner);
  const [channel, setChannel] = useAtom(editIdeaFields.channel);

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
  const [label, setLabel] = useAtom(editIdeaFields.label);
  const [status, setStatus] = useAtom(editIdeaFields.status);

  const handleStatusChange = (value: string) => {
    const nextValue = (value || "") as typeof status;
    setStatus(nextValue);

    // Only sync column for Concept <-> To Stream transitions
    // "Recorded" and other statuses should NOT change the column
    if (value === "To Stream") {
      scheduleUpdate({ status: value, column: "To Stream" });
    } else if (value === "Concept") {
      scheduleUpdate({ status: value, column: "Concept" });
    } else {
      // For Recorded and other statuses, only update status, not column
      scheduleUpdate({ status: value || undefined });
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="edit-label" className="text-sm">
          Label
        </Label>
        <LabelSelect
          id="edit-label"
          labels={label}
          onChange={(next) => {
            setLabel(next);
            scheduleUpdate({ label: next });
          }}
        />
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
  const [potential, setPotential] = useAtom(editIdeaFields.potential);
  const [adReadTracker, setAdReadTracker] = useAtom(editIdeaFields.adReadTracker);
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
          <Input
            id="edit-ad-read-tracker"
            value={adReadTracker ? "•••••" : ""}
            placeholder="Not set"
            disabled
            onChange={(event) => {
              setAdReadTracker(event.target.value);
              scheduleUpdate({ adReadTracker: event.target.value });
            }}
          />
        </div>
      )}
    </div>
  );
});

const NotesField = memo(function NotesField({ scheduleUpdate }: FieldProps) {
  const [notes, setNotes] = useAtom(editIdeaFields.notes);

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

export function EditIdeaModal({ open, onOpenChange }: EditIdeaModalProps) {
  const [isEditing, setIsEditing] = useAtom(editIdeaIsEditingAtom);
  const title = useAtomValue(editIdeaFields.title);
  const description = useAtomValue(editIdeaFields.description);
  const notes = useAtomValue(editIdeaFields.notes);
  const thumbnail = useAtomValue(editIdeaFields.draftThumbnail);
  const thumbnailReady = useAtomValue(editIdeaFields.thumbnailReady);
  const resources = useAtomValue(editIdeaFields.resources);
  const vodRecordingDate = useAtomValue(editIdeaFields.vodRecordingDate);
  const releaseDate = useAtomValue(editIdeaFields.releaseDate);
  const owner = useAtomValue(editIdeaFields.owner);
  const channel = useAtomValue(editIdeaFields.channel);
  const potential = useAtomValue(editIdeaFields.potential);
  const label = useAtomValue(editIdeaFields.label);
  const status = useAtomValue(editIdeaFields.status);
  const adReadTracker = useAtomValue(editIdeaFields.adReadTracker);
  const unsponsored = useAtomValue(editIdeaFields.unsponsored);
  const streamMode = useAtomValue(streamModeAtom);
  const resourceList = resources.length ? resources : [""];

  const { scheduleUpdate, isPending, isSuccess } = useScheduledUpdate();

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
            <div className="space-y-4">
              <TitleField scheduleUpdate={scheduleUpdate} />
              <DescriptionField scheduleUpdate={scheduleUpdate} />
            </div>
            <ResourcesSection scheduleUpdate={scheduleUpdate} />
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
            <OwnerChannelSection scheduleUpdate={scheduleUpdate} />
            <LabelStatusSection scheduleUpdate={scheduleUpdate} />
            <PotentialAdReadSection scheduleUpdate={scheduleUpdate} />
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
            labels={label}
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
