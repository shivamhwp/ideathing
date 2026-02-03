import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TopNav } from "@/components/TopNav";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.ideas.queries.list, {}));
    await context.queryClient.ensureQueryData(convexQuery(api.notion.queries.getConnection, {}));
    await context.queryClient.ensureQueryData(
      convexQuery(api.notion.queries.getConnectionStatus, {}),
    );
  },
  component: App,
});

function App() {
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-4 py-4 flex flex-col flex-1 min-h-0 gap-4">
        <TopNav />
        <KanbanBoard />
      </div>
    </div>
  );
}
