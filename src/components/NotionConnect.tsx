import {
  Check,
  Database,
  SpinnerGap,
  WarningCircle,
  Info,
  ArrowSquareOut,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/utils";

export function NotionConnect() {
  const [showModal, setShowModal] = useState(false);
  const connection = useQuery(api.notion.getConnection);

  if (connection === undefined) {
    return null;
  }

  return (
    <>
      <Button
        variant={connection ? "outline" : "secondary"}
        size="sm"
        onClick={() => setShowModal(true)}
        className={cn(
          connection && "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
        )}
      >
        <Database className="w-4 h-4 mr-1.5" weight="duotone" />
        <span className="text-xs">{connection ? "Connected" : "Connect Notion"}</span>
        {connection && <Check className="w-3.5 h-3.5 ml-1" weight="bold" />}
      </Button>

      <NotionConnectModal open={showModal} onOpenChange={setShowModal} isConnected={!!connection} />
    </>
  );
}

function NotionConnectModal({
  open,
  onOpenChange,
  isConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected: boolean;
}) {
  const [integrationToken, setIntegrationToken] = useState("");
  const [databaseId, setDatabaseId] = useState("");
  const [targetSection, setTargetSection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const connect = useMutation(api.notion.connect);
  const disconnect = useMutation(api.notion.disconnect);
  const testConnection = useMutation(api.notion.testConnection);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integrationToken.trim() || !databaseId.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await testConnection({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
      });

      if (!result.success) {
        setError(result.error || "Failed to connect to Notion");
        return;
      }

      await connect({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
        targetSection: targetSection.trim() || "Vid It",
      });

      setIntegrationToken("");
      setDatabaseId("");
      setTargetSection("");
      onOpenChange(false);
    } catch (err) {
      setError("Failed to connect. Please check your credentials.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isConnected ? "Notion Connection" : "Connect to Notion"}</DialogTitle>
          {!isConnected && (
            <DialogDescription>
              Sync your ideas to a Notion database when you move them to "Vid It"
            </DialogDescription>
          )}
        </DialogHeader>

        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-md">
              <Check className="w-5 h-5 text-primary" weight="bold" />
              <div>
                <p className="font-medium text-sm text-primary">Connected to Notion</p>
                <p className="text-xs text-primary/70">
                  Your ideas will sync when moved to "Vid It"
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <>
            {/* Help Section */}
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Info className="w-4 h-4" />
              <span>{showHelp ? "Hide" : "Show"} setup instructions</span>
            </button>

            {showHelp && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-2">1. Create a Notion Integration</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                    <li>
                      Go to{" "}
                      <a
                        href="https://www.notion.so/my-integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        notion.so/my-integrations
                        <ArrowSquareOut className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Click "New integration"</li>
                    <li>Give it a name (e.g., "Ideate")</li>
                    <li>
                      Copy the "Internal Integration Secret" (starts with{" "}
                      <code className="bg-muted px-1 rounded text-[10px]">ntn_</code>)
                    </li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">2. Get Your Database ID</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Open your Notion database page</li>
                    <li>
                      Look at the URL:{" "}
                      <code className="bg-muted px-1 rounded text-[10px]">
                        notion.so/[workspace]/[database-id]?v=...
                      </code>
                    </li>
                    <li>The database ID is the 32-character string before the "?"</li>
                    <li>
                      Example:{" "}
                      <code className="bg-muted px-1 rounded text-[10px]">a1b2c3d4e5f6...</code>
                    </li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">
                    3. Connect Integration to Database
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Open your database in Notion</li>
                    <li>Click "..." menu → "Connections"</li>
                    <li>Search and add your integration</li>
                  </ol>
                </div>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive rounded-md">
                  <WarningCircle className="w-4 h-4 flex-shrink-0" weight="fill" />
                  <p className="text-xs">{error}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="token">
                  Integration Token <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="token"
                  type="password"
                  value={integrationToken}
                  onChange={(e) => setIntegrationToken(e.target.value)}
                  placeholder="ntn_..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="database">
                  Database ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="database"
                  type="text"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  placeholder="a1b2c3d4e5f6g7h8i9j0..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="section">Target Status/Section (optional)</Label>
                <Input
                  id="section"
                  type="text"
                  value={targetSection}
                  onChange={(e) => setTargetSection(e.target.value)}
                  placeholder="Vid It"
                />
                <p className="text-[10px] text-muted-foreground">
                  If your database has a Status property, ideas will be created with this status
                </p>
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!integrationToken.trim() || !databaseId.trim() || isSubmitting}
                >
                  {isSubmitting && <SpinnerGap className="w-4 h-4 mr-1.5 animate-spin" />}
                  {isSubmitting ? "Connecting..." : "Connect"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
