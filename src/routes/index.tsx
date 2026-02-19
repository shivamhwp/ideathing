import { SpinnerIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { AppCommandCenter } from "@/components/AppCommandCenter";
import { KanbanBoard } from "@/components/KanbanBoard";
import { TheoIdeaQueue } from "@/components/TheoIdeaQueue";
import { TopNav } from "@/components/TopNav";
import { useTheoMode } from "@/hooks/useTheoMode";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const { isTheoMode, isCheckingMode } = useTheoMode();

  if (isCheckingMode) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

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
