import { CheckCircleIcon, SpinnerIcon, XCircleIcon } from "@phosphor-icons/react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

type NotionCallbackSearch = {
  code?: string;
  state?: string;
  error?: string;
};

type NotionCallbackData = {
  status: "success" | "error";
  errorMessage?: string;
};

export const Route = createFileRoute("/_authenticated/notion/callback")({
  component: NotionCallback,
});

function NotionCallback() {
  const params = useSearch({
    from: "/_authenticated/notion/callback",
  }) as NotionCallbackSearch;
  const navigate = useNavigate();
  const [loaderData, setLoaderData] = useState<NotionCallbackData | null>(null);
  const exchangeOAuthCodeMutation = useAction(api.notion.actions.exchangeOAuthCode);
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    if (exchangeAttempted.current) return;
    exchangeAttempted.current = true;

    const code = params.code;
    const state = params.state;
    const error = params.error;

    const setStatusAndRedirect = (status: "success" | "error", errorMessage?: string) => {
      setLoaderData({ status, errorMessage });
      const delay = status === "success" ? 2000 : 3000;
      setTimeout(() => {
        void navigate({ to: "/settings/notion" });
      }, delay);
    };

    if (error) {
      setStatusAndRedirect("error", error);
      return;
    }

    if (!code || !state) {
      setStatusAndRedirect("error", "missing_code_or_state");
      return;
    }

    exchangeOAuthCodeMutation({ code, state })
      .then(() => setStatusAndRedirect("success"))
      .catch((err) => {
        console.error("OAuth exchange error:", err);
        setStatusAndRedirect("error", "exchange_failed");
      });
  }, [params.code, params.state, params.error, exchangeOAuthCodeMutation, navigate]);

  const errorMessages: Record<string, string> = {
    access_denied: "You denied access to Notion",
    exchange_failed: "Failed to exchange authorization code",
    missing_code_or_state: "Missing required OAuth parameters",
    invalid_state: "Invalid OAuth state",
  };

  const errorMessage =
    loaderData?.status === "error"
      ? errorMessages[loaderData.errorMessage || ""] || "An unknown error occurred"
      : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 text-center space-y-4">
          {!loaderData && (
            <>
              <SpinnerIcon className="size-12 text-primary animate-spin mx-auto" />
              <p className="text-lg font-medium text-foreground">Processing OAuth callback...</p>
            </>
          )}

          {loaderData?.status === "success" && (
            <>
              <CheckCircleIcon className="size-12 text-primary mx-auto" weight="fill" />
              <p className="text-lg font-medium text-foreground">
                Successfully connected to Notion!
              </p>
              <p className="text-sm text-muted-foreground">Redirecting to settings...</p>
            </>
          )}

          {loaderData?.status === "error" && (
            <>
              <XCircleIcon className="size-12 text-destructive mx-auto" weight="fill" />
              <p className="text-lg font-medium text-destructive">Connection failed</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <p className="text-xs text-muted-foreground">Redirecting to settings...</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
