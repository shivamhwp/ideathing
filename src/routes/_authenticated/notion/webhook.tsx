import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/env/client";

export const Route = createFileRoute("/_authenticated/notion/webhook")({
  component: NotionWebhooksPage,
});

function NotionWebhooksPage() {
  const convexSiteUrl =
    env.VITE_CONVEX_SITE_URL || env.VITE_CONVEX_URL.replace(".convex.cloud", ".convex.site");
  const webhookUrl = convexSiteUrl ? `${convexSiteUrl}/notion/webhook` : null;

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

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Webhook endpoint</CardTitle>
            <CardDescription>Use your Convex HTTP endpoint (not the app domain).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground break-all">
              {webhookUrl ??
                "Set VITE_CONVEX_URL (or VITE_CONVEX_SITE_URL) to see the full webhook URL here."}
            </div>
            <p className="text-xs text-muted-foreground">
              If your Convex URL ends in{" "}
              <code className="rounded bg-muted px-1 py-0.5">.convex.cloud</code>, replace it with{" "}
              <code className="rounded bg-muted px-1 py-0.5">.convex.site</code> for webhooks.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Create a webhook subscription in your Notion integration.</li>
              <li>Set the webhook URL to the endpoint above.</li>
              <li>
                Subscribe to events:{" "}
                <code className="rounded bg-muted px-1 py-0.5">page.properties_updated</code> (and
                optionally <code className="rounded bg-muted px-1 py-0.5">page.created</code> /{" "}
                <code className="rounded bg-muted px-1 py-0.5">page.content_updated</code>
                ).
              </li>
              <li>Complete the Notion verification step and copy the verification token.</li>
              <li>
                Set{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  NOTION_WEBHOOK_VERIFICATION_TOKEN
                </code>{" "}
                in your Convex env to enable signature validation.
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
