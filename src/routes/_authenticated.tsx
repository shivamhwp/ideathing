import { useUser } from "@clerk/tanstack-react-start";
import { SpinnerIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useAtom } from "jotai";
import { AddIdeaModal } from "@/components/AddIdeaModal";
import { useEffect, useRef } from "react";
import { useTheoMode } from "@/hooks/useTheoMode";
import { AppCommandCenter } from "@/components/AppCommandCenter";
import { addIdeaModalOpenAtom } from "@/store/atoms";

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
  const { isTheoMode } = useTheoMode();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setAddModalOpen] = useAtom(addIdeaModalOpenAtom);
  const prevSignedIn = useRef(isSignedIn);

  useEffect(() => {
    if (prevSignedIn.current && !isSignedIn) {
      queryClient.clear();
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn, queryClient]);

  useEffect(() => {
    if (!isTheoMode && isAddModalOpen) {
      setAddModalOpen(false);
    }
  }, [isAddModalOpen, isTheoMode, setAddModalOpen]);

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

  return (
    <>
      <AppCommandCenter />
      <Outlet />
      {isTheoMode ? <AddIdeaModal open={isAddModalOpen} onOpenChange={setAddModalOpen} /> : null}
    </>
  );
}
