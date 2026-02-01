import { SignInButton } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAtom } from "jotai";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import ClerkHeader from "@/integrations/clerk/header-user";
import { streamModeAtom } from "@/store/atoms";

export const Route = createFileRoute("/")({
  component: App,
  loader: async (opts) => {
    await opts.context.queryClient.ensureQueryData(convexQuery(api.notion.getConnection, {}));
  },
});

function App() {
  const [streamMode, setStreamMode] = useAtom(streamModeAtom);
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-4 py-6 flex flex-col flex-1 min-h-0 gap-4">
        <div className="flex items-center justify-between ">
          <div className="flex items-center gap-8">
            <span className="text-xl font-black font-mono hover:text-primary transition-colors flex items-center gap-2">
              ideathing
            </span>
            <Link to="/recorded" className="text-sm text-muted-foreground hover:text-foreground">
              / recorded vids
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Authenticated>
              <div className="flex items-center justify-end">
                <div className="flex items-center gap-2">
                  <Switch
                    id="stream-mode"
                    checked={streamMode}
                    onChange={(e) => setStreamMode(e.target.checked)}
                    aria-label="Stream Mode"
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Label
                        // htmlFor="stream-mode"
                        className="text-sm text-muted-foreground font-normal cursor-pointer"
                      >
                        Stream Mode
                      </Label>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 text-sm text-muted-foreground">
                      <p>
                        Stream Mode hides sponsor-related fields (Ad Read Tracker and Unsponsored)
                        for a cleaner view during streaming.
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <NotionConnect />
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <ClerkHeader />
              </div>
            </Authenticated>
            <Unauthenticated>
              <Button asChild size="sm" variant="default" className="font-mono">
                <SignInButton mode="modal">sign in with google</SignInButton>
              </Button>
            </Unauthenticated>
          </div>
        </div>

        <KanbanBoard />
      </div>
    </div>
  );
}
