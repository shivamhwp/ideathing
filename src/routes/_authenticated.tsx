import { useUser } from "@clerk/tanstack-react-start";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SpinnerIcon } from "@phosphor-icons/react";
import { getClerkAuth } from "../lib/server/auth";

export const Route = createFileRoute("/_authenticated")({
  loader: async () => {
    const { isSignedIn } = await getClerkAuth();
    if (!isSignedIn) {
      throw redirect({ to: "/" });
    }
    return null;
  },
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

  if (!isSignedIn) return null;

  return <Outlet />;
}
