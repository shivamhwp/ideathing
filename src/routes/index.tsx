import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import ClerkHeader from "@/integrations/clerk/header-user";

export const Route = createFileRoute("/")({ component: App });

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold">ideate</span>
          </div>
          <div className="flex items-center gap-3">
            <Authenticated>
              <NotionConnect />
              <ThemeToggle />
              <ClerkHeader />
            </Authenticated>
            <Unauthenticated>
              <Button>sign in</Button>
            </Unauthenticated>
          </div>
        </div>

        <KanbanBoard />
      </div>
    </div>
  );
}
