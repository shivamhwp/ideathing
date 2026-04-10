import { MinusIcon, PlusIcon, UploadIcon, XIcon } from "@phosphor-icons/react";
import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { memo, useState } from "react";
import { labelValues, type LabelValue } from "../../../shared/idea-values";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

interface TitleFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  hideLabel?: boolean;
  placeholder?: string;
}

export const TitleField = memo(function TitleField({
  id,
  value,
  onChange,
  autoFocus,
  hideLabel = false,
  placeholder = "What's the hook?",
}: TitleFieldProps) {
  return (
    <div className={hideLabel ? "space-y-0" : "space-y-1.5"}>
      {!hideLabel ? (
        <Label htmlFor={id} className="text-sm">
          Title <span className="text-destructive">*</span>
        </Label>
      ) : null}
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    </div>
  );
});

interface DescriptionFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  hideLabel?: boolean;
  placeholder?: string;
}

export const DescriptionField = memo(function DescriptionField({
  id,
  value,
  onChange,
  hideLabel = false,
  placeholder = "One-line summary",
}: DescriptionFieldProps) {
  return (
    <div className={hideLabel ? "space-y-0" : "space-y-1.5"}>
      {!hideLabel ? (
        <Label htmlFor={id} className="text-sm">
          Description
        </Label>
      ) : null}
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
});

interface ResourcesSectionProps {
  resources: string[];
  onChange: (next: string[]) => void;
  id?: string;
  hideLabel?: boolean;
  placeholder?: string;
  entryMode?: "list" | "paste";
}

const splitResourceInput = (value: string) =>
  value
    .split(/[\s,]+/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

const normalizeResources = (resources: string[]) =>
  resources.map((entry) => entry.trim()).filter(Boolean);

export const ResourcesSection = memo(function ResourcesSection({
  resources,
  onChange,
  id,
  hideLabel = false,
  placeholder = "Add resource URL",
  entryMode = "list",
}: ResourcesSectionProps) {
  const [draftValue, setDraftValue] = useState("");
  const normalizedResources = normalizeResources(resources);
  const resourceList = resources.length ? resources : [""];

  const setNormalizedResources = (next: string[]) => {
    const uniqueResources = Array.from(new Set(normalizeResources(next)));
    onChange(uniqueResources.length ? uniqueResources : [""]);
  };

  const appendResources = (value: string) => {
    const nextResources = splitResourceInput(value);
    if (!nextResources.length) return false;
    setNormalizedResources([...normalizedResources, ...nextResources]);
    return true;
  };

  const commitDraft = () => {
    if (!draftValue.trim()) return;
    if (appendResources(draftValue)) {
      setDraftValue("");
    }
  };

  const updateResource = (index: number, value: string) => {
    const next = resources.length ? [...resources] : [""];
    next[index] = value;
    onChange(next);
  };

  const addResource = () => {
    onChange([...(resources.length ? resources : [""]), ""]);
  };

  const removeResource = (index: number) => {
    if (resources.length <= 1) {
      onChange([""]);
      return;
    }
    const next = resources.filter((_, i) => i !== index);
    onChange(next.length ? next : [""]);
  };

  const removeNormalizedResource = (resource: string) => {
    const next = normalizedResources.filter((entry) => entry !== resource);
    onChange(next.length ? next : [""]);
  };

  const handlePaste = (value: string) => {
    if (!appendResources(value)) return false;
    setDraftValue("");
    return true;
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!draftValue.trim()) return;
    if (event.key === "Enter" || event.key === "," || event.key === " ") {
      event.preventDefault();
      commitDraft();
    }
  };

  if (entryMode === "paste") {
    return (
      <div className={hideLabel ? "space-y-0" : "space-y-2"}>
        {!hideLabel ? (
          <Label htmlFor={id} className="text-sm">
            Resources
          </Label>
        ) : null}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <Textarea
            id={id}
            value={draftValue}
            onChange={(event) => setDraftValue(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={handleDraftKeyDown}
            onPaste={(event) => {
              const pastedText = event.clipboardData.getData("text");
              if (!handlePaste(pastedText)) return;
              event.preventDefault();
            }}
            placeholder={placeholder}
            className="min-h-[84px] resize-none border-none bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
          />
          <p className="pt-2 text-xs text-muted-foreground">
            Paste one or many links. Spaces, commas, and new lines split them automatically.
          </p>
        </div>
        {normalizedResources.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {normalizedResources.map((resource) => (
              <Badge
                key={resource}
                variant="secondary"
                className="max-w-full gap-1.5 rounded-full px-3 py-1"
              >
                <span className="truncate">{resource}</span>
                <button
                  type="button"
                  onClick={() => removeNormalizedResource(resource)}
                  className="rounded-full text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${resource}`}
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={hideLabel ? "space-y-0" : "space-y-1.5"}>
      {!hideLabel ? (
        <Label htmlFor={id} className="text-sm">
          Resources
        </Label>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {resourceList.map((resource, index) => (
          <div key={`resource-${index}`} className="flex items-center gap-2">
            <Input
              id={index === 0 ? id : undefined}
              type="url"
              value={resource}
              onChange={(e) => updateResource(index, e.target.value)}
              placeholder={index === 0 ? placeholder : "Another resource URL"}
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
        <div className="sm:col-span-2">
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

interface LabelSelectProps {
  id?: string;
  labels: LabelValue[];
  onChange: (next: LabelValue[]) => void;
  placeholder?: string;
  actionLabel?: string;
}

export const LabelSelect = memo(function LabelSelect({
  id,
  labels,
  onChange,
  placeholder = "Not set",
  actionLabel = "Select",
}: LabelSelectProps) {
  const orderedLabels = labelValues.filter((label) => labels.includes(label));
  const visibleLabels = orderedLabels.slice(0, 2);
  const extraCount = orderedLabels.length - visibleLabels.length;

  const toggleLabel = (label: LabelValue) => {
    const nextLabels = labels.includes(label)
      ? labels.filter((value) => value !== label)
      : [...labels, label];
    const orderedNext = labelValues.filter((value) => nextLabels.includes(value));
    onChange(orderedNext);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          variant="outline"
          type="button"
          className="w-full justify-between text-left font-normal"
        >
          {orderedLabels.length ? (
            <span className="flex items-center gap-1.5">
              {visibleLabels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
              {extraCount > 0 && (
                <span className="text-xs text-muted-foreground">+{extraCount}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <span className="text-muted-foreground text-xs">{actionLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[220px]">
        {labelValues.map((label) => (
          <DropdownMenuCheckboxItem
            key={label}
            checked={labels.includes(label)}
            onCheckedChange={() => toggleLabel(label)}
            onSelect={(event) => event.preventDefault()}
          >
            {label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

interface ThumbnailFieldProps {
  labelId: string;
  thumbnail: string;
  thumbnailReady: boolean;
  showPreview: boolean;
  previewUrl?: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onThumbnailChange: (value: string) => void;
  onThumbnailReadyChange: (next: boolean) => void;
  hideLabel?: boolean;
  inputPlaceholder?: string;
  showReadyToggle?: boolean;
}

export const ThumbnailField = memo(function ThumbnailField({
  labelId,
  thumbnail,
  thumbnailReady,
  showPreview,
  previewUrl,
  fileInputRef,
  onFileSelect,
  onClear,
  onThumbnailChange,
  onThumbnailReadyChange,
  hideLabel = false,
  inputPlaceholder = "Paste image URL",
  showReadyToggle = true,
}: ThumbnailFieldProps) {
  return (
    <div className={hideLabel ? "space-y-0" : "space-y-1.5"}>
      {!hideLabel ? <Label className="text-sm">Thumbnail</Label> : null}
      {showPreview ? (
        <div className="group relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-muted/30">
          {previewUrl ? (
            <img src={previewUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" />
          )}
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 rounded-md bg-background/80 p-1 opacity-100 transition-opacity backdrop-blur-sm sm:opacity-0 sm:group-hover:opacity-100"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            type="url"
            value={thumbnail}
            onChange={(e) => onThumbnailChange(e.target.value)}
            placeholder={inputPlaceholder}
            className="flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileSelect}
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
      {showReadyToggle ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id={labelId}
            checked={thumbnailReady}
            onChange={(e) => onThumbnailReadyChange(e.target.checked)}
          />
          <Label htmlFor={labelId} className="text-sm text-muted-foreground font-normal">
            Thumbnail ready
          </Label>
        </div>
      ) : null}
    </div>
  );
});
