import { SignInButton } from "@clerk/tanstack-react-start";
import {
  CalendarDotsIcon,
  ColumnsPlusRightIcon,
  GearSixIcon,
  PlusIcon,
} from "@phosphor-icons/react";
import { Link, useLocation } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { useAtom, useSetAtom } from "jotai";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useTheoMode } from "@/hooks/useTheoMode";
import {
  addIdeaModalOpenAtom,
  openCreateIdeaSidebarAtom,
  workspaceViewModeAtom,
} from "@/store/atoms";
import { cn } from "@/utils/utils";

export function TopNav() {
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const pathname = useLocation({ select: (location) => location.pathname });
  const openCreateIdeaSidebar = useSetAtom(openCreateIdeaSidebarAtom);
  const openAddIdeaModal = useSetAtom(addIdeaModalOpenAtom);
  const [workspaceViewMode, setWorkspaceViewMode] = useAtom(workspaceViewModeAtom);
  const showWorkspaceControls = !isCheckingMode && pathname === "/";
  const navHeight = "h-10";
  const baseLink = "text-foreground/40 hover:text-primary text-sm font-semibold transition-colors";
  const boardLink = cn(baseLink, "flex items-center gap-2 font-semibold");
  const brandLink = cn(
    boardLink,
    navHeight,
    "items-center font-display text-[1.75rem] leading-none",
  );
  const boardLinkActive = cn(brandLink, "text-primary");
  const recordedLink = cn(
    baseLink,
    "flex items-center rounded-md px-1 font-semibold duration-200 text-foreground/40 transition",
    navHeight,
  );
  const recordedLinkActive = cn(recordedLink, "font-semibold text-foreground text-primary");

  return (
    <div
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 select-none",
        navHeight,
      )}
    >
      <div className="flex h-full min-w-0 items-center gap-3 sm:gap-4">
        <Authenticated>
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className={brandLink}
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
              brandLink,
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

      <div className={cn("flex min-w-[19rem] shrink-0 items-center justify-end gap-2", navHeight)}>
        <Authenticated>
          <div className={cn("flex min-w-[12.5rem] items-center justify-end gap-2", navHeight)}>
            {showWorkspaceControls ? (
              <>
                {!isTheoMode ? (
                  <div className="flex items-center rounded-full border border-border/60 bg-card/80 p-1 shadow-xs">
                    <Button
                      type="button"
                      variant={workspaceViewMode === "board" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setWorkspaceViewMode("board")}
                      className="rounded-full"
                    >
                      <ColumnsPlusRightIcon className="h-4 w-4" weight="duotone" />
                      Board
                    </Button>
                    <Button
                      type="button"
                      variant={workspaceViewMode === "calendar" ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setWorkspaceViewMode("calendar")}
                      className="rounded-full"
                    >
                      <CalendarDotsIcon className="h-4 w-4" weight="duotone" />
                      Calendar
                    </Button>
                  </div>
                ) : null}
                <Button
                  onClick={() => {
                    if (isTheoMode) {
                      openAddIdeaModal(true);
                    } else {
                      openCreateIdeaSidebar();
                    }
                  }}
                  variant="secondary"
                  size="icon"
                  aria-label="Add idea"
                  className="cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4" weight="bold" />
                </Button>
              </>
            ) : (
              <div className={navHeight} aria-hidden="true" />
            )}
          </div>
          {!isCheckingMode && isTheoMode ? <NotionConnect /> : null}
          <div className={cn("flex items-center", navHeight)}>
            <div className={cn("flex items-center rounded-md bg-primary/10", navHeight)}>
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
