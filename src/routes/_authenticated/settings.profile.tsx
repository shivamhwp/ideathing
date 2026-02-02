import {
  OrganizationSwitcher,
  UserButton,
  useOrganization,
  useUser,
} from "@clerk/tanstack-react-start";
import { ShieldCheckIcon, SpinnerIcon, UserIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, membership } = useOrganization();

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
            <h2 className="text-lg font-semibold">{user.fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {user.primaryEmailAddress?.emailAddress}
            </p>
            {organization && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-muted-foreground">Organization: {organization.name}</p>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">
                    <ShieldCheckIcon className="w-3 h-3" weight="fill" />
                    Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                    <UserIcon className="w-3 h-3" weight="fill" />
                    Member
                  </span>
                )}
              </div>
            )}
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
    </div>
  );
}
