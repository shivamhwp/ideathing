import { Plus, SpinnerGap, Trash, Upload, X } from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Idea } from "./KanbanBoard";

interface EditIdeaModalProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ThumbnailPreview({ thumbnail }: { thumbnail: string }) {
  const isStorageId = thumbnail.startsWith("k") && !thumbnail.includes("://");
  const storageUrl = useQuery(
    api.files.getUrl,
    isStorageId ? { storageId: thumbnail as Id<"_storage"> } : "skip",
  );
  const imageUrl = isStorageId ? storageUrl : thumbnail;

  if (!imageUrl) return null;
  return <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />;
}

export function EditIdeaModal({ idea, open, onOpenChange }: EditIdeaModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [resources, setResources] = useState<string[]>([""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateIdea = useMutation(api.ideas.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  // Load idea data when modal opens
  useEffect(() => {
    if (idea && open) {
      setTitle(idea.title);
      setDescription(idea.description || "");
      setThumbnailUrl(idea.thumbnail || "");
      setResources(idea.resources?.length ? idea.resources : [""]);
      setThumbnailFile(null);
      setThumbnailPreview(null);
    }
  }, [idea, open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailUrl("");
      const reader = new FileReader();
      reader.onload = (e) => {
        setThumbnailPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailUrl("");
    setThumbnailPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea || !title.trim()) return;

    setIsSubmitting(true);
    try {
      let finalThumbnail: string | undefined = thumbnailUrl.trim() || undefined;

      if (thumbnailFile) {
        setIsUploading(true);
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": thumbnailFile.type },
          body: thumbnailFile,
        });
        const { storageId } = await result.json();
        finalThumbnail = storageId;
        setIsUploading(false);
      }

      await updateIdea({
        id: idea._id,
        title: title.trim(),
        description: description.trim() || undefined,
        thumbnail: finalThumbnail,
        resources: resources.filter((r) => r.trim()),
      });

      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const addResource = () => {
    setResources([...resources, ""]);
  };

  const updateResource = (index: number, value: string) => {
    const newResources = [...resources];
    newResources[index] = value;
    setResources(newResources);
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  const currentThumbnail =
    thumbnailPreview || (thumbnailUrl && !thumbnailFile ? thumbnailUrl : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl p-0 gap-0 border-border/50">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50">
          <DialogTitle className="text-xl font-semibold tracking-tight">Edit Idea</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="edit-title" className="text-sm font-medium">
              Title <span className="text-primary">*</span>
            </Label>
            <Input
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's your idea?"
              autoFocus
              className="h-10 bg-muted/30 border-border/50 focus-visible:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description" className="text-sm font-medium">
              Description
            </Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your idea in a few words..."
              rows={3}
              className="resize-none bg-muted/30 border-border/50 focus-visible:bg-background transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Thumbnail</Label>
            {currentThumbnail ? (
              <div className="group relative rounded-xl overflow-hidden border border-border/50 aspect-video bg-muted/20">
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ThumbnailPreview thumbnail={thumbnailUrl} />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <button
                  type="button"
                  onClick={clearThumbnail}
                  className="absolute top-3 right-3 p-1.5 bg-background/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="Paste image URL or upload"
                  className="flex-1 h-10 bg-muted/30 border-border/50 focus-visible:bg-background transition-colors"
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
                  className="h-10 w-10 border-border/50 hover:bg-muted/50"
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Resources</Label>
            <div className="space-y-2">
              {resources.map((resource, index) => (
                <div key={index} className="flex gap-2 group">
                  <Input
                    type="url"
                    value={resource}
                    onChange={(e) => updateResource(index, e.target.value)}
                    placeholder="https://example.com"
                    className="h-10 bg-muted/30 border-border/50 focus-visible:bg-background transition-colors"
                  />
                  {resources.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResource(index)}
                      className="h-10 w-10 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addResource}
              className="text-muted-foreground hover:text-foreground"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add resource
            </Button>
          </div>
        </form>

        <DialogFooter className="px-6 py-4 border-t border-border/50 bg-muted/20">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="hover:bg-muted/50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="min-w-[100px]"
          >
            {isSubmitting ? (
              <>
                <SpinnerGap className="w-4 h-4 mr-2 animate-spin" />
                {isUploading ? "Uploading..." : "Saving..."}
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
