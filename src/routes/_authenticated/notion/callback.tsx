import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/notion/callback")({
  component: NotionCallback,
});

// OAuth is no longer used - redirect to settings
function NotionCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/settings/notion" });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md text-center space-y-2">
        <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
      </div>
    </div>
  );
}
