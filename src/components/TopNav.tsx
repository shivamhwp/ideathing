import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { GearSixIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAtom, useSetAtom } from "jotai";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { commandMenuOpenAtom, streamModeAtom } from "@/store/atoms";
import { cn } from "@/utils/utils";

export function TopNav() {
  const [streamMode, setStreamMode] = useAtom(streamModeAtom);
  const setCommandMenuOpen = useSetAtom(commandMenuOpenAtom);
  const baseLink = "text-foreground/40 hover:text-primary font-semibold transition-colors";
  const boardLink = cn(baseLink, "flex items-center gap-2 font-semibold");
  const boardLinkActive = cn(boardLink, "text-primary font-semibold");
  const recordedLink = cn(
    baseLink,
    "p-1 rounded-md font-semibold duration-200 text-foreground/40 transition",
  );
  const recordedLinkActive = cn(recordedLink, "font-semibold text-foreground text-primary");

  return (
    <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="flex items-center gap-4 justify-self-start">
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
          preload="intent"
          activeOptions={{ exact: true }}
          className={recordedLink}
          activeProps={{ className: recordedLinkActive }}
        >
          recorded vids
        </Link>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCommandMenuOpen(true)}
        className="text-foreground/30"
        aria-label="Open command menu"
      >
        cmd + k
      </Button>
      <div className="flex items-center gap-2 justify-self-end">
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
                  <Link to="/settings/profile" preload="intent">
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
