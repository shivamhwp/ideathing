import {
	OrganizationSwitcher,
	UserButton,
	useOrganization,
	useUser,
} from "@clerk/tanstack-react-start";
import { SpinnerIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/settings/profile")({
	component: ProfileSettings,
});

function ProfileSettings() {
	const { user, isLoaded: isUserLoaded } = useUser();
	const { organization } = useOrganization();

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

	return (
		<div className="space-y-6">
			{/* User Info Card */}
			<div className="rounded-xl border border-border/50 items-center bg-card/50 p-6 justify-between flex">
				<div className="flex items-center gap-4">
					<UserButton
						appearance={{
							elements: {
								rootBox: "flex",
								userButtonTrigger:
									"px-4 py-2 rounded-md border border-border/50 hover:bg-accent/50 transition-colors text-sm font-medium flex items-center gap-2",
								userButtonBox: "flex-row-reverse",
								avatarBox: "w-10 h-10",
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
							<p className="text-xs text-muted-foreground mt-1">
								Organization: {organization.name}
							</p>
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
								rootBox: "flex items-center",
								organizationSwitcherTrigger:
									"rounded-md border border-border/50  hover:bg-accent/50 transition-colors text-lg",
							},
						}}
					/>
				</div>
			</div>
		</div>
	);
}
