import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { AppCommandCenter } from "@/components/AppCommandCenter";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TheoIdeaQueue } from "@/components/TheoIdeaQueue";
import { TopNav } from "@/components/TopNav";
import { theoModeQuery, useTheoMode } from "@/hooks/useTheoMode";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(theoModeQuery);
    await context.queryClient.ensureQueryData(convexQuery(api.ideas.queries.list, {}));
    await context.queryClient.ensureQueryData(convexQuery(api.ideas.queries.listTheoQueue, {}));
  },
  component: App,
});

function App() {
  const { isTheoMode } = useTheoMode();

  return (
    <div className="h-dvh flex flex-col bg-background">
      <div className="px-4 py-4 flex h-full flex-col flex-1 min-h-0 gap-4">
        <AppCommandCenter />
        <TopNav />
        {isTheoMode ? <TheoIdeaQueue /> : <KanbanBoard />}
      </div>
    </div>
  );
}
