import { MinusIcon, PlusIcon, UploadIcon, XIcon } from "@phosphor-icons/react";
import type { ChangeEvent, RefObject } from "react";
import { memo } from "react";
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

interface TitleFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export const TitleField = memo(function TitleField({
  id,
  value,
  onChange,
  autoFocus,
}: TitleFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        Title <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's the hook?"
        autoFocus={autoFocus}
      />
    </div>
  );
});

interface DescriptionFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export const DescriptionField = memo(function DescriptionField({
  id,
  value,
  onChange,
}: DescriptionFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        Description
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="One-line summary"
      />
    </div>
  );
});

interface ResourcesSectionProps {
  resources: string[];
  onChange: (next: string[]) => void;
  id?: string;
}

export const ResourcesSection = memo(function ResourcesSection({
  resources,
  onChange,
  id,
}: ResourcesSectionProps) {
  const resourceList = resources.length ? resources : [""];

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

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        Resources
      </Label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {resourceList.map((resource, index) => (
          <div key={`resource-${index}`} className="flex items-center gap-2">
            <Input
              id={index === 0 ? id : undefined}
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
}

export const LabelSelect = memo(function LabelSelect({ id, labels, onChange }: LabelSelectProps) {
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
            <span className="text-muted-foreground">Not set</span>
          )}
          <span className="text-muted-foreground text-xs">Select</span>
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
}: ThumbnailFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">Thumbnail</Label>
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
            placeholder="Paste image URL"
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
    </div>
  );
});
