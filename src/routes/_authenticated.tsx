import { useOrganization, useUser } from "@clerk/tanstack-react-start";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    </div>
  ),
});

function AuthenticatedLayout() {
  const { isSignedIn, isLoaded } = useUser();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const prevOrgId = useRef<string | null>(organization?.id ?? null);
  const prevSignedIn = useRef(isSignedIn);

  useEffect(() => {
    if (prevSignedIn.current && !isSignedIn) {
      queryClient.clear();
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    const orgId = organization?.id ?? null;
    if (prevOrgId.current !== orgId) {
      void queryClient.invalidateQueries();
      prevOrgId.current = orgId;
    }
  }, [organization?.id, queryClient]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
