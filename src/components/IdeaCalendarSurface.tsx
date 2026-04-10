import { format } from "date-fns";
import type { ComponentProps } from "react";
import type { Idea } from "./KanbanBoard";
import { Calendar, CalendarDayButton } from "./ui/calendar";
import { cn } from "@/utils/utils";

type IdeaCalendarSurfaceProps = {
  ideasByDay: Map<string, Idea[]>;
  month: Date;
  selectedDate: Date;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: Date) => void;
  onOpenIdea: (idea: Idea) => void;
};

export function IdeaCalendarSurface({
  ideasByDay,
  month,
  selectedDate,
  onMonthChange,
  onSelectDate,
  onOpenIdea,
}: IdeaCalendarSurfaceProps) {
  const components = {
    MonthGrid: ({ className, ...props }) => (
      <div {...props} className={cn("grid h-full min-h-0 grid-rows-[auto_1fr] gap-2", className)} />
    ),
    Weekdays: ({ className, ...props }) => (
      <div {...props} className={cn("grid grid-cols-7 gap-2", className)} />
    ),
    Weekday: ({ className, scope: _scope, ...props }) => (
      <div {...props} className={cn("flex items-center justify-center", className)} />
    ),
    Weeks: ({ className, ...props }) => (
      <div {...props} className={cn("grid h-full min-h-0 auto-rows-fr gap-2", className)} />
    ),
    Week: ({ className, week: _week, ...props }) => (
      <div {...props} className={cn("grid min-h-0 grid-cols-7 gap-2", className)} />
    ),
    Day: ({ className, day, children, onClick, ...props }) => {
      const dayKey = format(day.date, "yyyy-MM-dd");
      const dayIdeas = ideasByDay.get(dayKey) ?? [];

      return (
        <div
          {...props}
          onClick={(event) => {
            onClick?.(event);
            if (!event.defaultPrevented) {
              onSelectDate(day.date);
            }
          }}
          className={cn("min-w-0 min-h-0 h-full", className)}
        >
          <div
            className={cn(
              "flex h-full min-h-0 cursor-pointer flex-col gap-2 rounded-lg border border-border/60 bg-background/80 p-2.5 transition-colors hover:border-primary/20 hover:bg-background",
              dayIdeas.length > 0 && "bg-card/90 shadow-xs",
              day.outside && "bg-muted/35",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              {children}
              {dayIdeas.length > 0 ? (
                <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                  {dayIdeas.length}
                </span>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
              {dayIdeas.map((idea) => (
                <button
                  key={idea._id}
                  type="button"
                  title={idea.title}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenIdea(idea);
                  }}
                  className="w-full rounded-lg bg-muted/70 px-2 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground"
                >
                  <span className="line-clamp-2">{idea.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    },
    DayButton: ({ className, day, ...props }) => (
      <CalendarDayButton
        day={day}
        className={cn(
          "aspect-auto size-8 min-w-0 self-start rounded-lg border border-transparent bg-transparent p-0 text-xs font-semibold text-foreground shadow-none hover:bg-muted/80 hover:text-foreground data-[selected-single=true]:border-primary/20 data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground [&>span]:text-xs [&>span]:opacity-100",
          className,
        )}
        {...props}
      >
        <span>{day.date.getDate()}</span>
      </CalendarDayButton>
    ),
  } satisfies NonNullable<ComponentProps<typeof Calendar>["components"]>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/60 bg-card/70 shadow-sm">
      <Calendar
        mode="single"
        navLayout="around"
        month={month}
        onMonthChange={onMonthChange}
        selected={selectedDate}
        onSelect={(date) => date && onSelectDate(date)}
        formatters={{
          formatCaption: (date) => format(date, "MMMM"),
        }}
        className="h-full w-full bg-transparent p-4 [--cell-size:2.5rem]"
        classNames={{
          root: "flex h-full w-full flex-col",
          months: "flex h-full w-full",
          month: "relative flex h-full w-full min-h-0 flex-col gap-4",
          button_previous: "absolute left-0 top-0 z-10 size-10 cursor-pointer rounded-lg",
          button_next: "absolute right-0 top-0 z-10 size-10 cursor-pointer rounded-lg",
          chevron: "size-5",
          month_caption: "relative mx-auto flex h-10 w-full items-center justify-center px-12",
          caption_label: "font-display text-[2.5rem] leading-none text-foreground",
          month_grid: "grid h-full min-h-0 grid-rows-[auto_1fr] gap-2",
          weekdays: "grid grid-cols-7 gap-2",
          weekday:
            "rounded-lg border border-border/50 bg-muted/50 px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground",
          weeks: "grid h-full min-h-0 auto-rows-fr gap-2",
          week: "grid min-h-0 grid-cols-7 gap-2",
          day: "group/day min-w-0 min-h-0 h-full",
          day_button:
            "aspect-auto size-8 min-w-0 rounded-lg border border-transparent bg-transparent p-0 text-xs font-semibold text-foreground shadow-none hover:bg-muted/80 hover:text-foreground data-[selected-single=true]:border-primary/20 data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground [&>span]:text-xs [&>span]:opacity-100",
          selected: "[&>div]:border-primary/35 [&>div]:bg-primary/6 [&>div]:shadow-sm",
          today: "[&>div]:border-foreground/15",
          outside: "opacity-60",
          disabled: "opacity-40",
          hidden: "invisible",
        }}
        components={components}
      />
    </div>
  );
}
