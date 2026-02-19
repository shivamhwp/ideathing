import {
  OrganizationSwitcher,
  UserButton,
  useOrganization,
  useUser,
} from "@clerk/tanstack-react-start";
import {
  CheckCircleIcon,
  ShieldCheckIcon,
  SpinnerIcon,
  UserIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { useTheoMode } from "@/hooks/useTheoMode";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { membership } = useOrganization();
  const { isTheoMode, isCheckingMode } = useTheoMode();

  if (!isUserLoaded || isCheckingMode) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Please sign in to view your profile.
      </div>
    );
  }

  const isAdmin = membership?.role === "org:admin" || membership?.role === "admin";
  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="flex flex-col gap-4 rounded-xl border border-border/50 bg-card/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 w-full justify-between">
          <UserButton
            appearance={{
              elements: {
                rootBox: "flex",
                avatarBox: "size-16 sm:size-20",
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Action label="manageAccount" />
            </UserButton.MenuItems>
          </UserButton>
          <div className="min-w-0 flex-1 sm:block hidden">
            <h2 className="flex flex-wrap items-center gap-2 ">
              <div className="text-lg font-semibold ">{user.fullName}</div>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 px-2  rounded text-xs bg-primary/10 text-primary">
                  <ShieldCheckIcon className="w-3 h-3" weight="fill" />
                  Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                  <UserIcon className="w-3 h-3" weight="fill" />
                  Member
                </span>
              )}
            </h2>
            <p className="text-sm sm:block hidden text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <OrganizationSwitcher
                hidePersonal={false}
                afterCreateOrganizationUrl="/"
                afterSelectOrganizationUrl="/"
                afterLeaveOrganizationUrl="/"
                appearance={{
                  elements: {
                    rootBox: "flex items-center justify-center gap-2",
                    avatarBox: "size-10",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {isTheoMode && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 sm:p-6">
          <div className="space-y-1 flex items-center justify-between">
            <h3 className="font-medium">Theo mode</h3>
            {isTheoMode ? (
              <CheckCircleIcon weight="fill" className="w-6 h-6 text-primary" />
            ) : (
              <XCircleIcon weight="fill" className="w-6 h-6 text-primary" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
