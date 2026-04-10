import { convexQuery } from "@convex-dev/react-query";
import { CalendarDotsIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";
import { format, isValid, parseISO, startOfToday } from "date-fns";
import { useSetAtom } from "jotai";
import { useState } from "react";
import {
  createIdeaDraftFromIdea,
  editIdeaDraftAtom,
  editIdeaIdAtom,
  editIdeaIsEditingAtom,
  editIdeaOpenAtom,
} from "@/store/atoms";
import type { Idea } from "./KanbanBoard";
import { IdeaCalendarSurface } from "./IdeaCalendarSurface";

const getReleaseDate = (idea: Idea) => {
  if (!idea.releaseDate) return null;
  const parsedDate = parseISO(idea.releaseDate);
  return isValid(parsedDate) ? parsedDate : null;
};

const hasReleaseDate = (entry: {
  idea: Idea;
  releaseDate: Date | null;
}): entry is { idea: Idea; releaseDate: Date } => entry.releaseDate !== null;

export function IdeaReleaseCalendar() {
  const { data: ideas, isLoading } = useQuery(convexQuery(api.ideas.queries.list, {}));
  const setEditDraft = useSetAtom(editIdeaDraftAtom);
  const setEditIdeaId = useSetAtom(editIdeaIdAtom);
  const setEditIdeaOpen = useSetAtom(editIdeaOpenAtom);
  const setEditIdeaIsEditing = useSetAtom(editIdeaIsEditingAtom);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [month, setMonth] = useState<Date | undefined>();

  const allIdeas = ideas ?? [];
  const scheduledIdeas = allIdeas
    .map((idea) => ({ idea, releaseDate: getReleaseDate(idea) }))
    .filter(hasReleaseDate)
    .sort((a, b) => a.releaseDate.getTime() - b.releaseDate.getTime());
  const today = startOfToday();
  const nextScheduledDate =
    scheduledIdeas.find((entry) => entry.releaseDate >= today)?.releaseDate ??
    scheduledIdeas[0]?.releaseDate ??
    today;
  const activeDate = selectedDate ?? nextScheduledDate;

  const ideasByDay = scheduledIdeas.reduce((map, entry) => {
    const dayKey = format(entry.releaseDate, "yyyy-MM-dd");
    return map.set(dayKey, [...(map.get(dayKey) ?? []), entry.idea]);
  }, new Map<string, Idea[]>());

  const openIdea = (idea: Idea) => {
    setEditDraft(createIdeaDraftFromIdea(idea));
    setEditIdeaId(idea._id);
    setEditIdeaIsEditing(false);
    setEditIdeaOpen(true);
  };

  if (isLoading || ideas === undefined) {
    return (
      <div className="flex h-full min-h-[50vh] w-full items-center justify-center">
        <SpinnerIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (scheduledIdeas.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-border/50 bg-card/50 p-6 text-center">
        <CalendarDotsIcon className="mb-3 h-12 w-12 text-muted-foreground/30" weight="duotone" />
        <p className="text-lg font-medium text-foreground">Nothing is scheduled yet.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Set a release date from the preview sidebar and the idea will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <IdeaCalendarSurface
      ideasByDay={ideasByDay}
      month={month ?? activeDate}
      selectedDate={activeDate}
      onMonthChange={setMonth}
      onSelectDate={(date) => {
        setSelectedDate(date);
        setMonth(date);
      }}
      onOpenIdea={openIdea}
    />
  );
}
