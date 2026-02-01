import { useUser } from "@clerk/tanstack-react-start";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SpinnerIcon } from "@phosphor-icons/react";

export const Route = createFileRoute("/_authenticated")({
	component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
	const { isSignedIn, isLoaded } = useUser();

	if (!isLoaded) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background">
				<SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
			</div>
		);
	}

	if (!isSignedIn) {
		// Redirect to home if not signed in
		window.location.href = "/";
		return null;
	}

	return <Outlet />;
}
