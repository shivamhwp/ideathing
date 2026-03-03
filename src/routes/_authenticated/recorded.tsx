import { convexQuery } from "@convex-dev/react-query";
import { CassetteTapeIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useSetAtom } from "jotai";
import { useState } from "react";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import type { Idea } from "@/components/KanbanBoard";
import { TopNav } from "@/components/TopNav";
import { useTheoMode } from "@/hooks/useTheoMode";
import { createIdeaDraftFromIdea, editIdeaDraftAtom } from "@/store/atoms";

export const Route = createFileRoute("/_authenticated/recorded")({
  component: RecordedIdeasPage,
});

function RecordedIdeasPage() {
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [focusedIdeaId, setFocusedIdeaId] = useState<Idea["_id"] | null>(null);
  const setDraft = useSetAtom(editIdeaDraftAtom);
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const { data: recorded, isLoading } = useQuery({
    ...convexQuery(api.ideas.queries.listRecorded, {}),
    gcTime: 60 * 60 * 1000, // 1 hour
    staleTime: 61 * 60 * 1000, // 1 hour + 1 minute
  });
  const recordedIdeas = recorded ?? [];

  const getIdeaDomId = (ideaId: Idea["_id"]) => `idea-card-${ideaId}`;

  const focusIdea = (ideaId: Idea["_id"] | null) => {
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
      : window.innerWidth >= 1024
        ? 3
        : window.innerWidth >= 768
          ? 2
          : 1;
  const canUseMotionHotkeys = !isCheckingMode && !isTheoMode && !isLoading && !editingIdea;
  const moveFocus = (step: number) => {
    if (recordedIdeas.length === 0) return;
    const currentIndex = recordedIdeas.findIndex((idea) => idea._id === focusedIdeaId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(recordedIdeas.length - 1, baseIndex + step));
    focusIdea(recordedIdeas[nextIndex]?._id ?? null);
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
    "Escape",
    () => {
      focusIdea(null);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  useHotkey(
    "Enter",
    () => {
      if (!focusedIdeaId) return;
      const focusedIdea = recordedIdeas.find((idea) => idea._id === focusedIdeaId);
      if (!focusedIdea) return;
      focusIdea(focusedIdea._id);
      setDraft(createIdeaDraftFromIdea(focusedIdea));
      setEditingIdea(focusedIdea);
    },
    {
      enabled: canUseMotionHotkeys && Boolean(focusedIdeaId),
      ignoreInputs: true,
      requireReset: true,
    },
  );

  if (isCheckingMode) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (isTheoMode) {
    return <Navigate to="/" replace />;
  }

  if (isLoading || !recorded) {
    return (
      <div className="min-h-dvh flex flex-col bg-background">
        <div className="px-4 py-6 flex flex-col flex-1 min-h-0 gap-4">
          <div className="h-[40vh] rounded-2xl border border-border/60 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <div className="px-4 py-4 flex flex-col flex-1 min-h-0 gap-4">
        <TopNav />
        <section className="flex-1 min-h-0 rounded-2xl border border-border/60 bg-card/40 p-4">
          {recorded?.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6">
              <div className="flex flex-col items-center justify-center text-xl text-muted-foreground/25">
                <CassetteTapeIcon weight="duotone" className="mb-2 h-12 w-12" />
                No recorded ideas yet.
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recorded.map((idea) => (
                  <IdeaCard
                    key={idea._id}
                    idea={idea}
                    onClick={() => {
                      focusIdea(idea._id);
                      setDraft(createIdeaDraftFromIdea(idea));
                      setEditingIdea(idea);
                    }}
                    isKeyboardFocused={focusedIdeaId === idea._id}
                    domId={getIdeaDomId(idea._id)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <EditIdeaModal
        key={editingIdea?._id ?? "edit-idea-recorded"}
        idea={editingIdea}
        open={!!editingIdea}
        onOpenChange={(open) => !open && setEditingIdea(null)}
      />
    </div>
  );
}
