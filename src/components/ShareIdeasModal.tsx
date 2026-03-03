import { useOrganization } from "@clerk/tanstack-react-start";
import {
  CheckIcon,
  ClockIcon,
  CopyIcon,
  LinkIcon,
  ShieldWarningIcon,
  SpinnerIcon,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ideaSelectionModeAtom } from "@/store/atoms";
import { Badge } from "./ui/badge";

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
  const createExport = useAction(api.ideas.actions.create);
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const copiedResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectionMode = useAtomValue(ideaSelectionModeAtom);
  const setSelectionMode = useSetAtom(ideaSelectionModeAtom);
  const visibleIdeaIds = selectionMode ? selectedIdeaIds : [];

  const clearCopiedResetTimeout = () => {
    if (!copiedResetTimeoutRef.current) return;
    clearTimeout(copiedResetTimeoutRef.current);
    copiedResetTimeoutRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearCopiedResetTimeout();
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearCopiedResetTimeout();
      setShareUrl(null);
      setExpiresAt(null);
      setCopied(false);
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
    if (visibleIdeaIds.length === 0) {
      toast.error("Select at least one idea to share");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createExport({
        ideaIds: visibleIdeaIds,
      });
      setShareUrl(result.shareUrl ?? null);
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
      setCopied(true);
      toast.success("Link copied");
      clearCopiedResetTimeout();
      copiedResetTimeoutRef.current = setTimeout(() => setCopied(false), 1000);
    } catch (error) {
      void error;
      toast.error("Failed to copy link");
    }
  };

  const handleClear = () => {
    onClearSelection?.();
    setSelectionMode(false);
    handleOpenChange(false);
  };
  const expirationLabel =
    expiresAt !== null ? new Date(expiresAt).toLocaleString() : "24 hours from creation";

  const canCreate = organization && isAdmin && visibleIdeaIds.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex w-full flex-col p-5" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Share Ideas</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Badge variant="secondary">
            <span className="size-1.5 rounded-full bg-primary" />
            {visibleIdeaIds.length} idea
            {visibleIdeaIds.length === 1 ? "" : "s"} selected
          </Badge>

          {!organization && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
              <ShieldWarningIcon className="mt-0.5 size-4 text-amber-500" weight="duotone" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Organization required
                </p>
                <p className="text-xs text-muted-foreground">
                  Select an organization to create share links.
                </p>
              </div>
            </div>
          )}

          {organization && !isAdmin && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
              <ShieldWarningIcon className="mt-0.5 size-4 text-amber-500" weight="duotone" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  Admin access required
                </p>
                <p className="text-xs text-muted-foreground">
                  Only organization admins can create share links.
                </p>
              </div>
            </div>
          )}

          {shareUrl && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3 w-full">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckIcon className="size-4 text-primary" weight="bold" />
                Link created successfully
              </div>
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1 rounded-md border border-border/60 bg-background px-3 py-2">
                  <div className="overflow-x-auto whitespace-nowrap w-full flex line-clamp-1 font-mono text-xs text-foreground">
                    {shareUrl}
                  </div>
                </div>
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <CheckIcon className="size-4" weight="bold" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ClockIcon className="size-3.5" weight="duotone" />
                Expires {expirationLabel}
              </div>
            </div>
          )}

          {!shareUrl && canCreate && (
            <p className="text-xs text-muted-foreground">
              Recipients can view the selected ideas but cannot edit them. Links expire after 24
              hours.
            </p>
          )}
        </div>

        <div
          className={`flex items-center justify-between  border-t pt-4 ${shareUrl ? "justify-end" : ""}`}
        >
          {!shareUrl && canCreate && (
            <Button
              onClick={handleCreate}
              size="sm"
              disabled={isCreating || !canCreate}
              className="min-w-[140px] gap-2 font-medium"
            >
              {isCreating ? (
                <>
                  <SpinnerIcon className="size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <LinkIcon className="size-4" />
                  Create link
                </>
              )}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className={`border-none cursor-pointer `}
            disabled={visibleIdeaIds.length === 0}
          >
            Clear & Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
