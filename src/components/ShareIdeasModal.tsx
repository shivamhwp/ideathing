import { useOrganization } from "@clerk/tanstack-react-start";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface ShareIdeasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIdeaIds: Id<"ideas">[];
  onClearSelection?: () => void;
}

export function ShareIdeasModal({
  open,
  onOpenChange,
  selectedIdeaIds,
  onClearSelection,
}: ShareIdeasModalProps) {
  const { organization, membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";
  const createExport = useAction(api.ideaExports.create);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setShareUrl(null);
      setExpiresAt(null);
    }
    onOpenChange(nextOpen);
  };

  const handleCreate = async () => {
    if (!organization) {
      toast.error("Select an organization to share ideas");
      return;
    }
    if (!isAdmin) {
      toast.error("Only organization admins can share ideas");
      return;
    }
    if (selectedIdeaIds.length === 0) {
      toast.error("Select at least one idea to share");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createExport({
        ideaIds: selectedIdeaIds,
      });
      const origin = window.location.origin;
      setShareUrl(`${origin}/share/${result.token}`);
      setExpiresAt(result.expiresAt);
      toast.success("Share link created");
    } catch (error) {
      void error;
      toast.error("Failed to create share link");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch (error) {
      void error;
      toast.error("Failed to copy link");
    }
  };

  const handleClear = () => {
    onClearSelection?.();
    toast.success("Selection cleared");
  };

  const expirationLabel =
    expiresAt !== null ? new Date(expiresAt).toLocaleString() : "24 hours from creation";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Share ideas</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Share a snapshot of {selectedIdeaIds.length} idea
            {selectedIdeaIds.length === 1 ? "" : "s"} with another organization. Links expire
            within 1 day.
          </p>

          {!organization && (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
              Select an organization to create a share link.
            </div>
          )}

          {organization && !isAdmin && (
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm">
              Only organization admins can create share links.
            </div>
          )}

          {shareUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly />
                <Button variant="outline" onClick={handleCopy}>
                  Copy
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Expires: {expirationLabel}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={handleClear} disabled={selectedIdeaIds.length === 0}>
            Clear selection
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !organization || !isAdmin || selectedIdeaIds.length === 0}
          >
            {isCreating ? "Creating..." : "Create share link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
