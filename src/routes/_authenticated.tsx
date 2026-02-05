import { useUser } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { SpinnerIcon } from "@phosphor-icons/react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { getClerkAuth } from "../lib/server/auth";

export const Route = createFileRoute("/_authenticated")({
  loader: async ({ context }) => {
    const { isSignedIn } = await getClerkAuth();
    if (!isSignedIn) {
      throw redirect({ to: "/" });
    }
    if (typeof window === "undefined") {
      await context.queryClient.ensureQueryData(
        convexQuery(api.notion.queries.getConnectionStatus, {}),
      );
      await context.queryClient.ensureQueryData(convexQuery(api.notion.queries.getConnection, {}));
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
