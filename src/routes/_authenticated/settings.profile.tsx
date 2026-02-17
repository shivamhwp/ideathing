import {
  OrganizationSwitcher,
  UserButton,
  useOrganization,
  useUser,
} from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { ShieldCheckIcon, SpinnerIcon, UserIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, membership } = useOrganization();
  const [isUpdatingTheoMode, setIsUpdatingTheoMode] = useState(false);
  const { data: modeData, isLoading: isModeLoading } = useQuery(
    convexQuery(api.mode.queries.getCurrentMode, {}),
  );
  const setTheoMode = useMutation(api.mode.mutations.setTheoMode);

  if (!isUserLoaded) {
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

  const isAdmin = membership?.role === "org:admin";
  const isTheoMode = modeData?.mode === "theo";
  const canManageTheoMode = modeData?.capabilities?.canManageTheoMode ?? false;
  const theoModeDescription = organization
    ? "Enable Theo workflow for this organization."
    : "Theo mode can only be managed inside an organization.";

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <UserButton
            appearance={{
              elements: {
                rootBox: "flex",
                avatarBox: "size-20",
              },
            }}
          >
            <UserButton.MenuItems>
              <UserButton.Action label="manageAccount" />
            </UserButton.MenuItems>
          </UserButton>
          <div className="flex-1">
            <h2 className="gap-2 flex">
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
              {isTheoMode && (
                <span className="inline-flex items-center gap-1 px-2 rounded text-xs bg-secondary/40 text-secondary-foreground">
                  Theo mode active
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
          </div>
        </div>
        <div>
          <OrganizationSwitcher
            hidePersonal={false}
            afterCreateOrganizationUrl="/"
            afterSelectOrganizationUrl="/"
            afterLeaveOrganizationUrl="/"
            appearance={{
              elements: {
                rootBox: "flex items-center justify-center gap-2",
                avatarBox: "size-10 ",
              },
            }}
          />
        </div>
      </div>

      {canManageTheoMode && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-medium">Theo mode</h3>
              <p className="text-sm text-muted-foreground">
                Enables Notion sync and Theo-specific metadata fields.
              </p>
              <p className="text-xs text-muted-foreground">{theoModeDescription}</p>
            </div>
            <div className="flex items-center gap-3">
              {(isModeLoading || isUpdatingTheoMode) && (
                <SpinnerIcon className="w-4 h-4 text-muted-foreground animate-spin" />
              )}
              <Switch
                id="theo-mode"
                checked={isTheoMode}
                disabled={isModeLoading || isUpdatingTheoMode}
                onChange={async (event) => {
                  const enabled = event.target.checked;
                  setIsUpdatingTheoMode(true);
                  try {
                    await setTheoMode({ enabled });
                    toast.success(enabled ? "Theo mode enabled" : "Theo mode disabled");
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Failed to update Theo mode",
                    );
                  } finally {
                    setIsUpdatingTheoMode(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
