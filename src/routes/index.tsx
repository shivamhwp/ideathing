import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { GearSixIcon } from "@phosphor-icons/react";
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
import { streamModeAtom } from "@/store/atoms";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.ideas.list, {}));
    await context.queryClient.ensureQueryData(convexQuery(api.notion.getConnection, {}));
    await context.queryClient.ensureQueryData(convexQuery(api.notion.getConnectionStatus, {}));
  },
  component: App,
});

function App() {
  const [streamMode, setStreamMode] = useAtom(streamModeAtom);
  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="px-4 py-4 flex flex-col flex-1 min-h-0 gap-4">
        <div className="flex items-center justify-between ">
          <div className="flex items-center justify-center gap-4">
            <Link
              to="/"
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              ideathing
            </Link>
            <Link
              to="/recorded"
              className="p-1 rounded-md text-muted-foreground hover:text-primary duration-200 transition"
            >
              recorded vids
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Authenticated>
              <div className="flex items-center justify-end gap-0">
                <div className="flex items-center gap-2">
                  <Switch
                    id="stream-mode"
                    checked={streamMode}
                    onChange={(e) => setStreamMode(e.target.checked)}
                    aria-label="Stream Mode"
                  />
                  <Popover>
                    <PopoverTrigger asChild className="bg-transparent">
                      <Label className="text-sm text-muted-foreground font-normal cursor-pointer">
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
              <div className="flex items-center">
                <SignedIn>
                  <div className="flex items-center bg-primary/10 rounded-md ">
                    <ThemeToggle className="bg-transparent" />
                    <Button asChild variant="ghost" size="icon">
                      <Link to="/settings/profile">
                        <GearSixIcon className="w-5 h-5" />
                      </Link>
                    </Button>
                  </div>
                </SignedIn>
                <SignedOut>
                  <SignInButton mode="modal">sign in with github</SignInButton>
                </SignedOut>
              </div>
            </Authenticated>
            <Unauthenticated>
              <ThemeToggle />
              <Button asChild size="sm" variant="default" className="font-mono">
                <SignInButton mode="modal">sign in </SignInButton>
              </Button>
            </Unauthenticated>
          </div>
        </div>
        <KanbanBoard />
      </div>
    </div>
  );
}
