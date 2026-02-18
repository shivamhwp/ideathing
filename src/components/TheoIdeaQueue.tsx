import { convexQuery } from "@convex-dev/react-query";
import { PlusIcon, SpinnerIcon, TrayIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { useAtom, useSetAtom } from "jotai";
import { AddIdeaModal } from "@/components/AddIdeaModal";
import { EditIdeaModal } from "@/components/EditIdeaModal";
import { IdeaCard } from "@/components/IdeaCard";
import { Button } from "@/components/ui/button";
import {
  addIdeaModalOpenAtom,
  createIdeaDraftFromIdea,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaIsEditingAtom,
  editIdeaOpenAtom,
  openAddIdeaModalAtom,
} from "@/store/atoms";

export function TheoIdeaQueue() {
  const { data: ideas, isLoading } = useQuery(convexQuery(api.ideas.queries.listTheoQueue, {}));
  const [editIdeaId, setEditIdeaId] = useAtom(editIdeaIdAtom);
  const [isEditOpen, setIsEditOpen] = useAtom(editIdeaOpenAtom);
  const [isAddModalOpen, setAddModalOpen] = useAtom(addIdeaModalOpenAtom);
  const [, setEditDraft] = useAtom(editIdeaDraftAtom);
  const [, setEditMode] = useAtom(editIdeaIsEditingAtom);
  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);

  if (isLoading || ideas === undefined) {
    return (
      <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const orderedIdeas = [...ideas].sort((a, b) => a.order - b.order);
  const activeIdea = orderedIdeas.find((idea) => idea._id === editIdeaId) ?? null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-3">
        <h2 className="text-sm font-semibold text-foreground">Theo Queue</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={openAddIdeaModal} className="cursor-pointer">
            <PlusIcon className="w-4 h-4" />
            Add Idea
          </Button>
        </div>
      </div>

      {orderedIdeas.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/40 gap-3">
          <TrayIcon className="w-10 h-10" />
          <p className="text-sm">No ideas left to send.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orderedIdeas.map((idea) => (
              <IdeaCard
                key={idea._id}
                idea={idea}
                onClick={() => {
                  setEditDraft(createIdeaDraftFromIdea(idea));
                  setEditMode(false);
                  setEditIdeaId(idea._id);
                  setIsEditOpen(true);
                }}
              />
            ))}
          </div>
        </div>
      )}

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
    </div>
  );
}
