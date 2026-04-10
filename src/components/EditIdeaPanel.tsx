import { convexQuery, useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import {
  CaretDownIcon,
  CheckCircleIcon,
  CheckIcon,
  LinkSimpleIcon,
  NoteIcon,
  SpinnerIcon,
  UploadIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useHotkey, useKeyHold } from "@tanstack/react-hotkeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { format } from "date-fns";
import { useAtom, useAtomValue } from "jotai";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { memo, useEffect, useRef, useState } from "react";
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
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useTheoMode } from "@/hooks/useTheoMode";
import {
  createIdeaDraftFromIdea,
  defaultIdeaDraft,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaFields,
  editIdeaIsEditingAtom,
  editIdeaModeAtom,
  newIdeaDraftAtom,
  newIdeaFields,
} from "@/store/atoms";
import { IdeaPreview } from "./IdeaPreview";
import type { Idea } from "./KanbanBoard";
import { Badge } from "./ui/badge";
import { cn } from "@/utils/utils";

interface EditIdeaPanelProps {
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

const ResourcesSection = memo(function ResourcesSection({
  scheduleUpdate,
  entryMode = "list",
}: FieldProps & {
  entryMode?: "list" | "paste";
}) {
  const [resources, setResources] = useAtom(editIdeaFields.resources);
  return (
    <IdeaResourcesSection
      id="edit-resources"
      resources={resources}
      entryMode={entryMode}
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
      showReadyToggle={false}
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
    <div className="grid grid-cols-2 gap-4">
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
              {formatDateValue(vodRecordingDate) ?? "Not set"}
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
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
              {formatDateValue(releaseDate) ?? "Not set"}
              <CaretDownIcon className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
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

const StatusPotentialSection = memo(function StatusPotentialSection({
  scheduleUpdate,
  theoMode,
}: FieldProps & {
  theoMode: boolean;
}) {
  const [status, setStatus] = useAtom(editIdeaFields.status);
  const [potential, setPotential] = useAtom(editIdeaFields.potential);

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
    <div className={theoMode ? "grid grid-cols-2 gap-4" : "space-y-1.5"}>
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
      {theoMode ? (
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
      ) : null}
    </div>
  );
});

const LabelAdReadSection = memo(function LabelAdReadSection({ scheduleUpdate }: FieldProps) {
  const [label, setLabel] = useAtom(editIdeaFields.label);
  const [thumbnailReady, setThumbnailReady] = useAtom(editIdeaFields.thumbnailReady);
  const [unsponsored, setUnsponsored] = useAtom(editIdeaFields.unsponsored);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] lg:items-end">
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
      <div className="flex flex-col gap-4 lg:pb-1">
        <div className="flex items-center gap-2">
          <Switch
            id="edit-thumbnail-ready-inline"
            checked={thumbnailReady}
            onChange={(e) => {
              setThumbnailReady(e.target.checked);
              scheduleUpdate({ thumbnailReady: e.target.checked });
            }}
          />
          <Label
            htmlFor="edit-thumbnail-ready-inline"
            className="text-sm text-muted-foreground font-normal"
          >
            Thumbnail ready
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="edit-unsponsored-inline"
            checked={unsponsored}
            onChange={(e) => {
              setUnsponsored(e.target.checked);
              scheduleUpdate({ unsponsored: e.target.checked });
            }}
          />
          <Label
            htmlFor="edit-unsponsored-inline"
            className="text-sm text-muted-foreground font-normal"
          >
            Unsponsored
          </Label>
        </div>
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
        className="min-h-[96px] resize-none"
      />
    </div>
  );
});

interface NonTheoIdeaWorkspaceProps extends FieldProps {
  thumbnailPreview: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearThumbnail: () => void;
  uploadFile: () => Promise<string | null>;
}

const tagStyles = "inline-flex items-center gap-2 rounded-md text-sm font-medium transition-colors";

const getTagVariantClass = (
  variant: "default" | "primary" | "secondary" | "muted" | "destructive",
) =>
  ({
    default: "bg-muted/60 text-muted-foreground",
    primary: "bg-primary/15 text-primary",
    secondary: "bg-secondary/40 text-secondary-foreground",
    muted: "bg-muted/40 text-muted-foreground",
    destructive: "bg-destructive/15 text-destructive",
  })[variant];

const splitResources = (value: string) =>
  value
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

const thumbnailOverlayClass =
  "h-10 rounded-md bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background";
const topControlClassName =
  "h-10 w-full border-border bg-muted/20 text-sm shadow-none focus:border-border focus:ring-0";

const NonTheoIdeaWorkspace = memo(function NonTheoIdeaWorkspace({
  scheduleUpdate,
  thumbnailPreview,
  fileInputRef,
  onFileSelect,
  onClearThumbnail,
  uploadFile,
}: NonTheoIdeaWorkspaceProps) {
  const [title, setTitle] = useAtom(editIdeaFields.title);
  const [notes, setNotes] = useAtom(editIdeaFields.notes);
  const [thumbnail, setThumbnail] = useAtom(editIdeaFields.draftThumbnail);
  const [, setThumbnailReady] = useAtom(editIdeaFields.thumbnailReady);
  const [resources, setResources] = useAtom(editIdeaFields.resources);
  const [releaseDate, setReleaseDate] = useAtom(editIdeaFields.releaseDate);
  const [status, setStatus] = useAtom(editIdeaFields.status);
  const [resourceDraft, setResourceDraft] = useState("");
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  const notesHeaderRef = useRef<HTMLDivElement | null>(null);
  const [notesMaxHeight, setNotesMaxHeight] = useState(240);

  const currentThumbnail = thumbnailPreview || thumbnail;
  const filteredResources = resources.map((entry) => entry.trim()).filter(Boolean);
  const recorded = status === "Recorded";
  const releaseLabel = formatDateValue(releaseDate);
  const normalizedStatus = status || "Concept";

  const handleStatusChange = (value: string) => {
    const nextValue = (value || "") as typeof status;
    setStatus(nextValue);
    if (value === "To Stream") {
      scheduleUpdate({ status: value, column: "To Stream" });
    } else if (value === "Concept") {
      scheduleUpdate({ status: value, column: "Concept" });
    } else {
      scheduleUpdate({ status: value || undefined });
    }
  };

  const setNormalizedResources = (next: string[]) => {
    const uniqueResources = Array.from(new Set(next.map((entry) => entry.trim()).filter(Boolean)));
    const finalResources = uniqueResources.length ? uniqueResources : [""];
    setResources(finalResources);
    scheduleUpdate({ resources: finalResources });
  };

  const commitResourceDraft = () => {
    const nextResources = splitResources(resourceDraft);
    if (!nextResources.length) return;
    setNormalizedResources([...filteredResources, ...nextResources]);
    setResourceDraft("");
  };

  const removeResource = (resource: string) => {
    const next = filteredResources.filter((entry) => entry !== resource);
    setNormalizedResources(next);
  };

  const handleResourceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!resourceDraft.trim()) return;
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      commitResourceDraft();
    }
  };

  const handleThumbnailSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event);
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
    onClearThumbnail();
    setThumbnail("");
    setThumbnailReady(false);
    scheduleUpdate({ clearThumbnail: true, thumbnailReady: false });
  };

  useEffect(() => {
    const section = notesSectionRef.current;
    if (!section) return;

    const updateNotesMaxHeight = () => {
      const headerHeight = notesHeaderRef.current?.offsetHeight ?? 0;
      const availableHeight = section.clientHeight - headerHeight - 12;
      setNotesMaxHeight(Math.max(availableHeight, 140));
    };

    updateNotesMaxHeight();

    const observer = new ResizeObserver(updateNotesMaxHeight);
    observer.observe(section);
    if (notesHeaderRef.current) observer.observe(notesHeaderRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="relative aspect-video shrink-0 bg-muted">
        {currentThumbnail ? (
          <img
            src={currentThumbnail}
            alt={title || "Idea thumbnail"}
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-full w-full items-center justify-center text-sm text-muted-foreground transition-colors hover:bg-muted/70"
          >
            No thumbnail
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleThumbnailSelect}
          className="hidden"
        />
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={thumbnailOverlayClass}
          >
            <span className="inline-flex items-center gap-1">
              <UploadIcon className="h-4 w-4" />
              {currentThumbnail ? "Replace" : "Add"}
            </span>
          </button>
          {currentThumbnail ? (
            <button
              type="button"
              onClick={clearThumbnail}
              className="rounded-md bg-background/85 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
              aria-label="Clear thumbnail"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <span
          className={cn(
            tagStyles,
            getTagVariantClass(recorded ? "primary" : "muted"),
            thumbnailOverlayClass,
            "absolute bottom-4 left-4",
          )}
        >
          <CheckCircleIcon weight={recorded ? "fill" : "regular"} className="h-4 w-4" />
          {recorded ? "Recorded" : "Not recorded"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
        <div className="space-y-4">
          <AutosizeTextarea
            value={title}
            onChange={(event) => {
              const next = event.target.value;
              setTitle(next);
              scheduleUpdate({ title: next });
            }}
            placeholder="Untitled idea"
            rows={1}
            minHeight={38}
            maxHeight={240}
            className="min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-2xl font-semibold leading-tight tracking-tight break-words text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={normalizedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className={topControlClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Concept">Concept</SelectItem>
                <SelectItem value="To Stream">To Stream</SelectItem>
                <SelectItem value="Recorded">Recorded</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    topControlClassName,
                    "justify-between font-normal text-foreground hover:bg-muted/20 focus-visible:border-border focus-visible:ring-0",
                  )}
                >
                  <span className="truncate">{releaseLabel || "Release Date"}</span>
                  <CaretDownIcon className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
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
                {releaseDate ? (
                  <div className="border-t border-border/50 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setReleaseDate("");
                        scheduleUpdate({ releaseDate: "" });
                      }}
                    >
                      Clear date
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="shrink-0 space-y-3">
          <div className="space-y-3">
            {filteredResources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredResources.map((resource) => (
                  <span
                    key={resource}
                    className="group relative inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 py-1 pl-2 pr-2 text-xs font-medium text-primary transition-[padding] hover:pr-6"
                  >
                    <LinkSimpleIcon weight="bold" className="h-3 w-3" />
                    <span className="max-w-[220px] truncate">{resource}</span>
                    <button
                      type="button"
                      onClick={() => removeResource(resource)}
                      className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-0.5 text-primary/70 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      aria-label={`Remove ${resource}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Input
              value={resourceDraft}
              onChange={(event) => setResourceDraft(event.target.value)}
              onBlur={commitResourceDraft}
              onKeyDown={handleResourceKeyDown}
              onPaste={(event) => {
                const pastedText = event.clipboardData.getData("text");
                const nextResources = splitResources(pastedText);
                if (!nextResources.length) return;
                event.preventDefault();
                setNormalizedResources([...filteredResources, ...nextResources]);
                setResourceDraft("");
              }}
              placeholder={filteredResources.length ? "Paste more links" : "Paste links"}
              className="h-11 rounded-lg border-0 bg-transparent px-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>

        <div ref={notesSectionRef} className="flex min-h-0 flex-1 flex-col gap-3">
          <div ref={notesHeaderRef} className="flex items-center gap-2">
            <NoteIcon weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
          </div>
          <AutosizeTextarea
            value={notes}
            onChange={(event) => {
              const next = event.target.value;
              setNotes(next);
              scheduleUpdate({ notes: next });
            }}
            placeholder="Loose thoughts, beats, punchlines…"
            minHeight={140}
            maxHeight={notesMaxHeight}
            className="h-full resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>
    </div>
  );
});

interface CreateNonTheoIdeaWorkspaceProps {
  thumbnailPreview: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearThumbnail: () => void;
}

const CreateNonTheoIdeaWorkspace = memo(function CreateNonTheoIdeaWorkspace({
  thumbnailPreview,
  fileInputRef,
  onFileSelect,
  onClearThumbnail,
}: CreateNonTheoIdeaWorkspaceProps) {
  const [title, setTitle] = useAtom(newIdeaFields.title);
  const [notes, setNotes] = useAtom(newIdeaFields.notes);
  const [thumbnail, setThumbnail] = useAtom(newIdeaFields.draftThumbnail);
  const [, setThumbnailReady] = useAtom(newIdeaFields.thumbnailReady);
  const [resources, setResources] = useAtom(newIdeaFields.resources);
  const [releaseDate, setReleaseDate] = useAtom(newIdeaFields.releaseDate);
  const [status, setStatus] = useAtom(newIdeaFields.status);
  const [resourceDraft, setResourceDraft] = useState("");
  const notesSectionRef = useRef<HTMLDivElement | null>(null);
  const notesHeaderRef = useRef<HTMLDivElement | null>(null);
  const [notesMaxHeight, setNotesMaxHeight] = useState(240);

  const currentThumbnail = thumbnailPreview || thumbnail;
  const filteredResources = resources.map((entry) => entry.trim()).filter(Boolean);
  const recorded = status === "Recorded";
  const releaseLabel = formatDateValue(releaseDate);
  const normalizedStatus = status || "Concept";

  const setNormalizedResources = (next: string[]) => {
    const uniqueResources = Array.from(new Set(next.map((entry) => entry.trim()).filter(Boolean)));
    setResources(uniqueResources.length ? uniqueResources : [""]);
  };

  const commitResourceDraft = () => {
    const nextResources = splitResources(resourceDraft);
    if (!nextResources.length) return;
    setNormalizedResources([...filteredResources, ...nextResources]);
    setResourceDraft("");
  };

  const removeResource = (resource: string) => {
    const next = filteredResources.filter((entry) => entry !== resource);
    setNormalizedResources(next);
  };

  const handleResourceKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!resourceDraft.trim()) return;
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      commitResourceDraft();
    }
  };

  const handleThumbnailSelect = (event: ChangeEvent<HTMLInputElement>) => {
    onFileSelect(event);
    setThumbnail("");
    setThumbnailReady(true);
  };

  const clearThumbnail = () => {
    onClearThumbnail();
    setThumbnail("");
    setThumbnailReady(false);
  };

  useEffect(() => {
    const section = notesSectionRef.current;
    if (!section) return;

    const updateNotesMaxHeight = () => {
      const headerHeight = notesHeaderRef.current?.offsetHeight ?? 0;
      const availableHeight = section.clientHeight - headerHeight - 12;
      setNotesMaxHeight(Math.max(availableHeight, 140));
    };

    updateNotesMaxHeight();

    const observer = new ResizeObserver(updateNotesMaxHeight);
    observer.observe(section);
    if (notesHeaderRef.current) observer.observe(notesHeaderRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="relative aspect-video shrink-0 bg-muted">
        {currentThumbnail ? (
          <img
            src={currentThumbnail}
            alt={title || "Idea thumbnail"}
            className="h-full w-full object-cover"
          />
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-full w-full items-center justify-center text-sm text-muted-foreground transition-colors hover:bg-muted/70"
          >
            No thumbnail
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleThumbnailSelect}
          className="hidden"
        />
        <div className="absolute right-4 bottom-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={thumbnailOverlayClass}
          >
            <span className="inline-flex items-center gap-1">
              <UploadIcon className="h-4 w-4" />
              {currentThumbnail ? "Replace" : "Add"}
            </span>
          </button>
          {currentThumbnail ? (
            <button
              type="button"
              onClick={clearThumbnail}
              className="rounded-md bg-background/85 p-1.5 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground"
              aria-label="Clear thumbnail"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <span
          className={cn(
            tagStyles,
            getTagVariantClass(recorded ? "primary" : "muted"),
            thumbnailOverlayClass,
            "absolute bottom-4 left-4",
          )}
        >
          <CheckCircleIcon weight={recorded ? "fill" : "regular"} className="h-4 w-4" />
          {recorded ? "Recorded" : "Not recorded"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-6 py-6">
        <div className="space-y-4">
          <AutosizeTextarea
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Untitled idea"
            rows={1}
            minHeight={38}
            maxHeight={240}
            className="min-h-0 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-2xl font-semibold leading-tight tracking-tight break-words text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              value={normalizedStatus}
              onValueChange={(value) => setStatus(value as typeof status)}
            >
              <SelectTrigger className={topControlClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Concept">Concept</SelectItem>
                <SelectItem value="To Stream">To Stream</SelectItem>
                <SelectItem value="Recorded">Recorded</SelectItem>
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    topControlClassName,
                    "justify-between font-normal text-foreground hover:bg-muted/20 focus-visible:border-border focus-visible:ring-0",
                  )}
                >
                  <span className="truncate">{releaseLabel || "Release Date"}</span>
                  <CaretDownIcon className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0"
                align="start"
                onOpenAutoFocus={(event) => event.preventDefault()}
              >
                <Calendar
                  mode="single"
                  selected={parseDateValue(releaseDate)}
                  onSelect={(date) => setReleaseDate(date ? format(date, "yyyy-MM-dd") : "")}
                  defaultMonth={parseDateValue(releaseDate)}
                />
                {releaseDate ? (
                  <div className="border-t border-border/50 p-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setReleaseDate("")}
                    >
                      Clear date
                    </Button>
                  </div>
                ) : null}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="shrink-0 space-y-3">
          <div className="space-y-3">
            {filteredResources.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredResources.map((resource) => (
                  <span
                    key={resource}
                    className="group relative inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 py-1 pl-2 pr-2 text-xs font-medium text-primary transition-[padding] hover:pr-6"
                  >
                    <LinkSimpleIcon weight="bold" className="h-3 w-3" />
                    <span className="max-w-[220px] truncate">{resource}</span>
                    <button
                      type="button"
                      onClick={() => removeResource(resource)}
                      className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full p-0.5 text-primary/70 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
                      aria-label={`Remove ${resource}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <Input
              value={resourceDraft}
              onChange={(event) => setResourceDraft(event.target.value)}
              onBlur={commitResourceDraft}
              onKeyDown={handleResourceKeyDown}
              onPaste={(event) => {
                const pastedText = event.clipboardData.getData("text");
                const nextResources = splitResources(pastedText);
                if (!nextResources.length) return;
                event.preventDefault();
                setNormalizedResources([...filteredResources, ...nextResources]);
                setResourceDraft("");
              }}
              placeholder={filteredResources.length ? "Paste more links" : "Paste links"}
              className="h-11 rounded-lg border-0 bg-transparent px-0 text-sm shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
            />
          </div>
        </div>

        <div ref={notesSectionRef} className="flex min-h-0 flex-1 flex-col gap-3">
          <div ref={notesHeaderRef} className="flex items-center gap-2">
            <NoteIcon weight="bold" className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Notes</span>
          </div>
          <AutosizeTextarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Loose thoughts, beats, punchlines…"
            minHeight={140}
            maxHeight={notesMaxHeight}
            className="h-full resize-none overflow-y-auto rounded-none border-0 bg-transparent px-0 py-0 text-sm leading-relaxed text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
      </div>
    </div>
  );
});

export function EditIdeaPanel({ idea, open, onOpenChange }: EditIdeaPanelProps) {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useAtom(editIdeaModeAtom);
  const [isEditing, setIsEditing] = useAtom(editIdeaIsEditingAtom);
  const [newDraft, setNewDraft] = useAtom(newIdeaDraftAtom);
  const [, setEditDraft] = useAtom(editIdeaDraftAtom);
  const [, setEditIdeaId] = useAtom(editIdeaIdAtom);
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
  const showCreateMode = !isTheoMode && editMode === "create";

  const { scheduleUpdate, isPending, isSuccess } = useScheduledUpdate();

  const {
    file: thumbnailFile,
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
  const { mutateAsync: createIdea, isPending: isCreatingIdea } = useMutation({
    mutationFn: useConvexMutation(api.ideas.mutations.create),
  });
  const { mutateAsync: moveIdea } = useMutation({
    mutationFn: useConvexMutation(api.ideas.mutations.move),
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearFileUpload();
      setIsEditing(false);
    }
    onOpenChange(nextOpen);
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

  const handleCreateIdea = async () => {
    const trimmedTitle = newDraft.title.trim();
    if (!trimmedTitle) {
      toast.error("Title is required");
      return;
    }

    try {
      const trimmedNotes = newDraft.notes.trim();
      const trimmedThumbnail = newDraft.draftThumbnail.trim();
      const cleanedResources = Array.from(
        new Set(newDraft.resources.map((resource) => resource.trim()).filter(Boolean)),
      );
      let finalThumbnail = trimmedThumbnail;

      if (thumbnailFile) {
        finalThumbnail = (await uploadFile()) ?? "";
      }

      const finalStatus = newDraft.status || "Concept";
      const ideaId = await createIdea({
        title: trimmedTitle,
        description: "",
        notes: trimmedNotes || "",
        draftThumbnail: finalThumbnail || undefined,
        thumbnailReady: Boolean(finalThumbnail),
        resources: cleanedResources,
        releaseDate: newDraft.releaseDate || undefined,
        status: finalStatus,
      });

      if (finalStatus === "To Stream") {
        const existingIdeas = await queryClient.ensureQueryData(
          convexQuery(api.ideas.queries.list, {}),
        );
        const toStreamOrder = existingIdeas.filter(
          (currentIdea) => currentIdea.column === "To Stream",
        ).length;

        await moveIdea({
          id: ideaId,
          column: "To Stream",
          order: toStreamOrder,
          status: "To Stream",
        });
      }

      setEditDraft(
        createIdeaDraftFromIdea({
          _id: ideaId,
          title: trimmedTitle,
          description: "",
          notes: trimmedNotes,
          draftThumbnail: finalThumbnail,
          thumbnailReady: Boolean(finalThumbnail),
          resources: cleanedResources,
          releaseDate: newDraft.releaseDate,
          status: finalStatus,
        }),
      );
      setEditMode("edit");
      setEditIdeaId(ideaId);
      setIsEditing(false);
      setNewDraft(defaultIdeaDraft);
      clearFileUpload();
      toast.success("Idea added");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add idea");
    }
  };

  useEffect(() => {
    if (open && idea) {
      setEditMode("edit");
    }
  }, [idea, open, setEditMode]);

  useHotkey(
    "E",
    () => {
      setIsEditing(true);
    },
    { enabled: open && isTheoMode && !isEditing, ignoreInputs: true, requireReset: true },
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

  useHotkey(
    "Mod+Enter",
    (event) => {
      if (event.isComposing) return;
      event.preventDefault();
      void handleCreateIdea();
    },
    {
      enabled: open && showCreateMode && !isCreatingIdea,
      requireReset: true,
    },
  );

  if (!open) return null;

  if (!isTheoMode) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/40 bg-background px-4 py-3">
          <p className="text-sm font-medium text-foreground">
            {showCreateMode ? "Add Idea" : "Edit Idea"}
          </p>
          <div className="flex items-center gap-2">
            {showCreateMode ? (
              <Button
                type="button"
                onClick={() => void handleCreateIdea()}
                disabled={isCreatingIdea || !newDraft.title.trim()}
              >
                {isCreatingIdea ? (
                  <>
                    <SpinnerIcon weight="bold" className="h-4 w-4 animate-spin" />
                    Adding
                  </>
                ) : (
                  "Done"
                )}
              </Button>
            ) : (
              <>
                {isPending ? (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <SpinnerIcon weight="bold" className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : null}
                {isSuccess ? (
                  <Badge variant="link" className="rounded-md px-3 py-2">
                    <CheckIcon weight="bold" className="h-4 w-4" />
                    Saved
                  </Badge>
                ) : null}
              </>
            )}
            <Button
              onClick={() => handleOpenChange(false)}
              variant="outline"
              size="icon"
              className="cursor-pointer border-none"
              aria-label="Close"
            >
              <XIcon weight="bold" className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {showCreateMode ? (
          <CreateNonTheoIdeaWorkspace
            thumbnailPreview={thumbnailPreview}
            fileInputRef={fileInputRef}
            onFileSelect={onFileSelect}
            onClearThumbnail={clearFileUpload}
          />
        ) : (
          <NonTheoIdeaWorkspace
            scheduleUpdate={scheduleUpdate}
            thumbnailPreview={thumbnailPreview}
            fileInputRef={fileInputRef}
            onFileSelect={onFileSelect}
            onClearThumbnail={clearFileUpload}
            uploadFile={uploadFile}
          />
        )}
      </div>
    );
  }

  return (
    <Tabs
      value={isEditing ? "edit" : "preview"}
      onValueChange={(value) => setIsEditing(value === "edit")}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-background"
    >
      <div className="sticky top-0 z-10 flex flex-row items-center justify-between border-b border-border/40 bg-background px-4 py-3">
        <TabsList className="grid w-fit grid-cols-2">
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>
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
      </div>

      {isEditing ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="space-y-4">
            <TitleField scheduleUpdate={scheduleUpdate} />
            <DescriptionField scheduleUpdate={scheduleUpdate} />
          </div>
          <div className="space-y-4 pt-4">
            <ResourcesSection scheduleUpdate={scheduleUpdate} />
            <ThumbnailSection
              scheduleUpdate={scheduleUpdate}
              thumbnailPreview={thumbnailPreview}
              fileInputRef={fileInputRef}
              onFileSelect={onFileSelect}
              onClear={clearFileUpload}
              uploadFile={uploadFile}
            />
            <DatesSection scheduleUpdate={scheduleUpdate} />
            {isTheoMode ? <OwnerChannelSection scheduleUpdate={scheduleUpdate} /> : null}
            <StatusPotentialSection scheduleUpdate={scheduleUpdate} theoMode={isTheoMode} />
            {isTheoMode ? <LabelAdReadSection scheduleUpdate={scheduleUpdate} /> : null}
            <NotesField scheduleUpdate={scheduleUpdate} />
          </div>
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
        </div>
      )}
    </Tabs>
  );
}
