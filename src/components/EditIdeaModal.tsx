import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import {
  CaretDownIcon,
  CheckIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  SpinnerIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useHotkey, useKeyHold } from "@tanstack/react-hotkeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import type { ChangeEvent, RefObject } from "react";
import { memo, useRef } from "react";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { formatDateValue, parseDateValue } from "@/components/idea-form/date-utils";
import {
  DescriptionField as IdeaDescriptionField,
  ResourcesSection as IdeaResourcesSection,
  ThumbnailField as IdeaThumbnailField,
  TitleField as IdeaTitleField,
  LabelSelect,
} from "@/components/idea-form/fields";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
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
import { useTheoMode } from "@/hooks/useTheoMode";
import { editIdeaFields, editIdeaIsEditingAtom } from "@/store/atoms";
import { IdeaPreview } from "./IdeaPreview";
import type { Idea } from "./KanbanBoard";
import { Badge } from "./ui/badge";

interface EditIdeaModalProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
};

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
    <div className="flex flex-col gap-4">
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    <div className="space-y-1.5">
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

const LabelPotentialAdReadSection = memo(function LabelPotentialAdReadSection({
  scheduleUpdate,
}: FieldProps) {
  const [label, setLabel] = useAtom(editIdeaFields.label);
  const [potential, setPotential] = useAtom(editIdeaFields.potential);
  const [adReadTracker, setAdReadTracker] = useAtom(editIdeaFields.adReadTracker);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
      <div className="space-y-1.5 sm:col-span-3">
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

export function EditIdeaModal({ idea, open, onOpenChange }: EditIdeaModalProps) {
  const queryClient = useQueryClient();
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
  const { isTheoMode } = useTheoMode();
  const isSHeld = useKeyHold("S");
  const resourceList = resources.length ? resources : [""];

  const { scheduleUpdate, isPending, isSuccess } = useScheduledUpdate();

  const {
    preview: thumbnailPreview,
    fileInputRef,
    handleFileSelect: onFileSelect,
    upload: uploadFile,
    clear: clearFileUpload,
  } = useFileUpload();
  const sendIdeaToNotionAction = useConvexAction(api.notion.actions.sendIdeaToNotion) as (args: {
    ideaId: Idea["_id"];
  }) => Promise<{
    success: true;
    status: "queued" | "already_sent" | "already_sending";
  }>;
  const { mutate: sendIdeaToNotion, isPending: isSendingToNotion } = useMutation({
    mutationFn: sendIdeaToNotionAction,
    onSuccess: async (result) => {
      if (result.status === "already_sent") {
        toast.info("Idea already sent to Notion.");
      } else if (result.status === "already_sending") {
        toast.info("Idea is already being sent to Notion.");
      } else {
        toast.success("Sending to Notion in background.");
      }
      await queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to send idea to Notion");
    },
  });
  const { mutateAsync: deleteIdea, isPending: isDeletingIdea } = useMutation({
    mutationFn: useConvexMutation(api.ideas.mutations.remove),
  });

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

  const handleSendToNotion = () => {
    if (!idea) {
      return;
    }
    handleOpenChange(false);
    sendIdeaToNotion({ ideaId: idea._id });
  };

  const handleDeleteIdea = async () => {
    if (!idea) {
      return;
    }

    try {
      await deleteIdea({ id: idea._id });
      toast.success("Idea deleted");
      await queryClient.invalidateQueries();
      handleOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete idea");
    }
  };

  useHotkey(
    "E",
    () => {
      handleEditToggle();
    },
    { enabled: open && !isEditing, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "N",
    (event) => {
      if (event.isComposing || isEditableTarget(event.target) || !isSHeld) return;
      event.preventDefault();
      handleSendToNotion();
    },
    {
      enabled:
        open &&
        isTheoMode &&
        Boolean(idea) &&
        !idea?.inNotion &&
        !isDeletingIdea &&
        !isSendingToNotion,
      ignoreInputs: true,
      requireReset: true,
    },
  );

  useHotkey(
    "D",
    (event) => {
      if (event.isComposing || isEditableTarget(event.target)) return;
      event.preventDefault();
      void handleDeleteIdea();
    },
    {
      enabled: open && isTheoMode && Boolean(idea) && !isDeletingIdea && !isSendingToNotion,
      ignoreInputs: true,
      requireReset: true,
    },
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="!flex !max-h-[92dvh] !w-[calc(100vw-1rem)] !flex-col overflow-hidden gap-0 p-0 sm:!w-full max-w-5xl"
      >
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-base font-medium text-muted-foreground">
              {isEditing ? "Edit Idea" : "Idea Details"}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
            <div className="space-y-4">
              <TitleField scheduleUpdate={scheduleUpdate} />
              <DescriptionField scheduleUpdate={scheduleUpdate} />
            </div>
            <ResourcesSection scheduleUpdate={scheduleUpdate} />
            <div className={isTheoMode ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "space-y-4"}>
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
                {isTheoMode ? <UnsponsoredSection scheduleUpdate={scheduleUpdate} /> : null}
              </div>
            </div>
            {isTheoMode ? <OwnerChannelSection scheduleUpdate={scheduleUpdate} /> : null}
            <LabelStatusSection scheduleUpdate={scheduleUpdate} />
            {isTheoMode ? <LabelPotentialAdReadSection scheduleUpdate={scheduleUpdate} /> : null}
            <NotesField scheduleUpdate={scheduleUpdate} />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
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
                theoMode={isTheoMode}
              />
            </div>
            <div className="flex flex-col gap-2 border-t border-border/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <Button
                type="button"
                variant="secondary"
                onClick={handleEditToggle}
                aria-label="Edit idea"
                className="cursor-pointer"
              >
                <PencilSimpleIcon weight="duotone" className="w-4 h-4" />
                Edit Idea
                <Kbd className="ml-2 hidden sm:inline-flex">e</Kbd>
              </Button>
              {isTheoMode ? (
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteIdea}
                    disabled={!idea || isDeletingIdea || isSendingToNotion}
                    className="cursor-pointer"
                  >
                    {isDeletingIdea ? (
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <TrashIcon className="w-4 h-4" />
                    )}
                    Delete
                    <Kbd className="hidden sm:inline-flex">d</Kbd>
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSendToNotion}
                    disabled={!idea || idea.inNotion || isDeletingIdea || isSendingToNotion}
                    className="cursor-pointer"
                  >
                    {isSendingToNotion ? (
                      <SpinnerIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <PaperPlaneTiltIcon className="w-4 h-4" />
                    )}
                    {idea?.inNotion ? "Sent to Notion" : "Send to Notion"}
                    {!idea?.inNotion && (
                      <KbdGroup className="ml-2 hidden sm:inline-flex">
                        <Kbd>s</Kbd>
                        <Kbd>n</Kbd>
                      </KbdGroup>
                    )}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
