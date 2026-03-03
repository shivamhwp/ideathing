import { convexQuery } from "@convex-dev/react-query";
import {
  PlusIcon,
  ShareNetworkIcon,
  SpinnerIcon,
  TrashIcon,
  TrayIcon,
} from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useState } from "react";
import { AddIdeaModal } from "@/components/AddIdeaModal";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import { ShareIdeasModal } from "@/components/ShareIdeasModal";
import { Button } from "@/components/ui/button";
import {
  addIdeaModalOpenAtom,
  commandMenuOpenAtom,
  createIdeaDraftFromIdea,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaIsEditingAtom,
  editIdeaOpenAtom,
  ideaSelectionModeAtom,
  openAddIdeaModalAtom,
} from "@/store/atoms";

export function TheoIdeaQueue() {
  const { data: ideas, isLoading } = useQuery(convexQuery(api.ideas.queries.listTheoQueue, {}));
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const [isAddModalOpen, setAddModalOpen] = useAtom(addIdeaModalOpenAtom);
  const [selectionMode, setSelectionMode] = useAtom(ideaSelectionModeAtom);
  const [, setEditDraft] = useAtom(editIdeaDraftAtom);
  const [, setEditMode] = useAtom(editIdeaIsEditingAtom);
  const commandCenterOpen = useAtomValue(commandMenuOpenAtom);
  const [focusedIdeaId, setFocusedIdeaId] = useState<Id<"ideas"> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Id<"ideas">[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
  const orderedIdeas = [...(ideas ?? [])].sort((a, b) => a.order - b.order);
  const activeIdea = orderedIdeas.find((idea) => idea._id === editIdeaId) ?? null;
  const selectedIdSet = new Set(selectedIds);

  const canUseMotionHotkeys =
    !isLoading &&
    ideas !== undefined &&
    !selectionMode &&
    !isAddModalOpen &&
    !isEditOpen &&
    !commandCenterOpen;

  const getIdeaDomId = (ideaId: Id<"ideas">) => `idea-card-${ideaId}`;

  const focusIdea = (ideaId: Id<"ideas"> | null) => {
    setFocusedIdeaId(ideaId);
    if (!ideaId) return;
    requestAnimationFrame(() => {
      document
        .getElementById(getIdeaDomId(ideaId))
        ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    });
  };

  const gridColumns =
    typeof window === "undefined"
      ? 1
      : window.innerWidth >= 1536
        ? 4
        : window.innerWidth >= 1280
          ? 3
          : window.innerWidth >= 768
            ? 2
            : 1;

  const moveFocus = (step: number) => {
    if (orderedIdeas.length === 0) return;
    const currentIndex = orderedIdeas.findIndex((idea) => idea._id === focusedIdeaId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(orderedIdeas.length - 1, baseIndex + step));
    focusIdea(orderedIdeas[nextIndex]?._id ?? null);
  };

  useHotkey(
    "J",
    () => {
      moveFocus(gridColumns);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "K",
    () => {
      moveFocus(-gridColumns);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "L",
    () => {
      moveFocus(1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "H",
    () => {
      moveFocus(-1);
    },
    { enabled: canUseMotionHotkeys, ignoreInputs: true, requireReset: true },
  );

  useHotkey(
    "Enter",
    () => {
      if (!focusedIdeaId) return;
      const focusedIdea = orderedIdeas.find((idea) => idea._id === focusedIdeaId);
      if (!focusedIdea) return;
      focusIdea(focusedIdea._id);
      setEditDraft(createIdeaDraftFromIdea(focusedIdea));
      setEditMode(false);
      setEditIdeaId(focusedIdea._id);
      setIsEditOpen(true);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  if (isLoading || ideas === undefined) {
    return (
      <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const handleSelectIdea = (ideaId: Id<"ideas">) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([ideaId]);
      return;
    }
    setSelectedIds((prev) => {
      const next = prev.includes(ideaId) ? prev.filter((id) => id !== ideaId) : [...prev, ideaId];
      if (next.length === 0) {
        setSelectionMode(false);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setShareModalOpen(false);
  };

  const handleQueuePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-idea-id]")) return;
    focusIdea(null);
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 px-2 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between py-2.5">
        <h2 className="text-sm font-semibold text-foreground">Theo Queue</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={openAddIdeaModal}
            className="cursor-pointer"
            size="icon"
          >
            <PlusIcon className="size-4" weight="bold" />
          </Button>
        </div>
      </div>

      {orderedIdeas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
          <TrayIcon className="w-10 h-10" />
          <p className="text-sm">No ideas left to send.</p>
        </div>
      ) : (
        <div
          className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          onPointerDown={handleQueuePointerDown}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {orderedIdeas.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onClick={() => {
                  focusIdea(idea._id);
                  setEditDraft(createIdeaDraftFromIdea(idea));
                  setEditMode(false);
                  setEditIdeaId(idea._id);
                  setIsEditOpen(true);
                }}
                selectionMode={selectionMode}
                selected={selectedIdSet.has(idea._id)}
                onToggleSelect={handleSelectIdea}
                isKeyboardFocused={focusedIdeaId === idea._id}
                domId={getIdeaDomId(idea._id)}
              />
            ))}
          </div>
        </div>
      )}

      {selectionMode && selectedIds.length > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-40 animate-in fade-in duration-150 sm:inset-x-auto sm:bottom-8 sm:right-8">
          <div className="w-full rounded-3xl border border-border/70 bg-popover/95 p-4 shadow-2xl backdrop-blur-xl sm:w-[280px]">
            <div className="flex flex-col items-start gap-2 px-1 pb-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center">
                <span>ideas selected</span>
                <span className="px-3 text-xs">{selectedIds.length}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={cancelSelection}
                className="text-xs font-medium transition hover:text-foreground cursor-pointer"
              >
                Deselect all
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => setShareModalOpen(true)}
                variant="secondary"
                className="h-10 w-full justify-start gap-2 rounded-full cursor-pointer bg-secondary/40 text-secondary-foreground hover:bg-secondary/60"
              >
                <ShareNetworkIcon className="h-4 w-4" weight="duotone" />
                Share ideas
              </Button>
              <Button
                variant="secondary"
                onClick={cancelSelection}
                className="h-10 w-full justify-start gap-2 cursor-pointer rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
              >
                <TrashIcon className="h-4 w-4" weight="duotone" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <AddIdeaModal open={isAddModalOpen} onOpenChange={setAddModalOpen} />

      <EditIdeaModal
        key={editIdeaId ?? "theo-edit-idea"}
        idea={activeIdea}
        open={isEditOpen}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) {
            setEditIdeaId(null);
          }
        }}
      />

      <ShareIdeasModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        selectedIdeaIds={selectedIds}
        onClearSelection={clearSelection}
      />
    </div>
  );
}
