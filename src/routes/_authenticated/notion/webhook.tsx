import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/notion/webhook")({
  component: NotionWebhooksPage,
});

function NotionWebhooksPage() {
  const convexUrl = (import.meta as any).env.VITE_CONVEX_URL as string | undefined;
  const webhookBase = convexUrl
    ? convexUrl.includes(".convex.cloud")
      ? convexUrl.replace(".convex.cloud", ".convex.site")
      : convexUrl
    : null;
  const webhookUrl = webhookBase ? `${webhookBase}/notion/webhook` : null;

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Notion Webhooks</h1>
            <p className="text-sm text-muted-foreground">
              Keep the app in sync when Notion properties change.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to board</Link>
          </Button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-foreground">Webhook endpoint</p>
            <p className="text-xs text-muted-foreground">
              Use your Convex HTTP endpoint (not the app domain).
            </p>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground break-all">
            {webhookUrl ?? "Set VITE_CONVEX_URL to see the full webhook URL here."}
          </div>
          <p className="text-[11px] text-muted-foreground">
            If your Convex URL ends in <span className="font-mono">.convex.cloud</span>, replace it
            with <span className="font-mono">.convex.site</span> for webhooks.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 space-y-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Checklist</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>Create a webhook subscription in your Notion integration.</li>
            <li>Set the webhook URL to the endpoint above.</li>
            <li>
              Subscribe to events: <span className="font-mono">page.properties_updated</span> (and
              optionally <span className="font-mono">page.created</span> /{" "}
              <span className="font-mono">page.content_updated</span>).
            </li>
            <li>Complete the Notion verification step and copy the verification token.</li>
            <li>
              Set <span className="font-mono">NOTION_WEBHOOK_VERIFICATION_TOKEN</span> in your
              Convex env to enable signature validation.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
