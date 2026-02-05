import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { GearSixIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAtom } from "jotai";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { streamModeAtom } from "@/store/atoms";
import { cn } from "@/utils/utils";

export function TopNav() {
  const [streamMode, setStreamMode] = useAtom(streamModeAtom);
  const baseLink = "text-muted-foreground hover:text-primary transition-colors";
  const boardLink = cn(baseLink, "flex items-center gap-2");
  const boardLinkActive = cn(boardLink, "text-primary");
  const recordedLink = cn(baseLink, "p-1 rounded-md duration-200 transition");
  const recordedLinkActive = cn(recordedLink, "text-primary");

  return (
    <div className="flex h-12 items-center justify-between">
      <div className="flex items-center justify-center gap-4">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          className={boardLink}
          activeProps={{ className: boardLinkActive }}
        >
          ideathing
        </Link>
        <Link
          to="/recorded"
          activeOptions={{ exact: true }}
          className={recordedLink}
          activeProps={{ className: recordedLinkActive }}
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
                    Stream Mode hides sponsor-related fields (Ad Read Tracker and Unsponsored) for a
                    cleaner view during streaming.
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
  );
}
