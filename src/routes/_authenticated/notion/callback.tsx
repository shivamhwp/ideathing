import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/notion/callback")({
  validateSearch: (search) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: NotionCallback,
});

function NotionCallback() {
  const navigate = useNavigate();
  const exchangeOAuthCode = useAction(api.notion.exchangeOAuthCode);
  const { code, state, error } = Route.useSearch();
  const [status, setStatus] = useState("Connecting your Notion workspace...");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      setStatus("Notion authorization failed.");
      setDetail(error);
      return;
    }

    if (!code || !state) {
      setStatus("Missing OAuth details.");
      setDetail("Please restart the Notion connection.");
      return;
    }

    let isActive = true;

    const exchange = async () => {
      try {
        await exchangeOAuthCode({ code, state });
        if (!isActive) return;
        setStatus("Notion connected! Redirecting...");
        setDetail(null);
        setTimeout(() => {
          void navigate({ to: "/" });
        }, 800);
      } catch (err) {
        if (!isActive) return;
        setStatus("Notion connection failed.");
        setDetail(err instanceof Error ? err.message : "Please try again.");
      }
    };

    void exchange();

    return () => {
      isActive = false;
    };
  }, [code, state, error, exchangeOAuthCode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md text-center space-y-2">
        <h1 className="text-lg font-semibold">Notion Connection</h1>
        <p className="text-sm text-muted-foreground">{status}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
