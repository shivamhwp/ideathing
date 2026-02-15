import { SignInButton } from "@clerk/tanstack-react-start";
import { GearSixIcon, TwitchLogoIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAtom } from "jotai";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { streamModeAtom } from "@/store/atoms";
import { cn } from "@/utils/utils";

export function TopNav() {
  const [streamMode, setStreamMode] = useAtom(streamModeAtom);
  const baseLink = "text-foreground/40 hover:text-primary font-semibold transition-colors";
  const boardLink = cn(baseLink, "flex items-center gap-2 font-semibold");
  const boardLinkActive = cn(boardLink, "text-primary font-semibold");
  const recordedLink = cn(
    baseLink,
    "p-1 rounded-md font-semibold duration-200 text-foreground/40 transition",
  );
  const recordedLinkActive = cn(recordedLink, "font-semibold text-foreground text-primary");

  return (
    <div className="flex h-12 w-full items-center justify-between gap-3 select-none">
      <div className="flex items-center gap-4">
        <Authenticated>
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
        </Authenticated>
        <Unauthenticated>
          <span
            className={cn(
              boardLink,
              "cursor-not-allowed text-foreground/30 hover:text-foreground/30",
            )}
          >
            ideathing
          </span>
          <span
            className={cn(
              recordedLink,
              "cursor-not-allowed text-foreground/30 hover:text-foreground/30",
            )}
          >
            recorded vids
          </span>
        </Unauthenticated>
      </div>

      <div className="flex items-center gap-2">
        <Authenticated>
          <div className="flex items-center justify-end gap-0">
            <Button
              type="button"
              variant={streamMode ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setStreamMode((prev) => !prev)}
              aria-label={streamMode ? "Disable stream mode" : "Enable stream mode"}
              className={cn("cursor-pointer", !streamMode && "text-foreground/60")}
            >
              <TwitchLogoIcon className="w-4 h-4" weight={streamMode ? "fill" : "regular"} />
            </Button>
          </div>
          <NotionConnect />
          <div className="flex items-center">
            <div className="flex items-center bg-primary/10 rounded-md ">
              <ThemeToggle className="bg-transparent" />
              <Button asChild variant="ghost" size="icon">
                <Link to="/settings/profile" preload="intent">
                  <GearSixIcon className="w-5 h-5" />
                </Link>
              </Button>
            </div>
          </div>
        </Authenticated>
        <Unauthenticated>
          <ThemeToggle />
          <Button asChild variant="default" className="font-mono cursor-pointer">
            <SignInButton mode="modal">sign in </SignInButton>
          </Button>
        </Unauthenticated>
      </div>
    </div>
  );
}
