import { SignInButton } from "@clerk/tanstack-react-start";
import { GearSixIcon, PlusIcon } from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useSetAtom } from "jotai";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useTheoMode } from "@/hooks/useTheoMode";
import { openAddIdeaModalAtom } from "@/store/atoms";
import { cn } from "@/utils/utils";

export function TopNav() {
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const pathname = useLocation({ select: (location) => location.pathname });
  const openAddIdeaModal = useSetAtom(openAddIdeaModalAtom);
  const baseLink = "text-foreground/40 hover:text-primary text-sm font-semibold transition-colors";
  const boardLink = cn(baseLink, "flex items-center gap-2 font-semibold");
  const boardLinkActive = cn(boardLink, "text-primary font-semibold");
  const recordedLink = cn(
    baseLink,
    "p-1 rounded-md font-semibold duration-200 text-foreground/40 transition",
  );
  const recordedLinkActive = cn(recordedLink, "font-semibold text-foreground text-primary");

  return (
    <div className="flex min-h-8 w-full items-center justify-between gap-3 select-none">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Authenticated>
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className={cn(boardLink, "font-display text-5xl")}
            activeProps={{ className: boardLinkActive }}
          >
            ideathing
          </Link>
          {!isCheckingMode && !isTheoMode ? (
            <Link
              to="/recorded"
              preload="intent"
              activeOptions={{ exact: true }}
              className={recordedLink}
              activeProps={{ className: recordedLinkActive }}
            >
              recorded vids
            </Link>
          ) : null}
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

      <div className="flex shrink-0 items-center gap-2">
        <Authenticated>
          {!isCheckingMode && pathname === "/" ? (
            <Button
              onClick={openAddIdeaModal}
              variant="secondary"
              size="icon"
              aria-label="Add idea"
              className="cursor-pointer"
            >
              <PlusIcon className="w-4 h-4" weight="bold" />
            </Button>
          ) : null}
          {!isCheckingMode && isTheoMode ? <NotionConnect /> : null}
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
