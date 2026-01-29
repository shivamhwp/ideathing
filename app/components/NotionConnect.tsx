import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Database,
  Check,
  WarningCircle,
  SpinnerGap,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

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
          connection &&
            "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
        )}
      >
        <Database className="w-4 h-4 mr-1.5" weight="duotone" />
        <span className="text-xs">
          {connection ? "Connected" : "Connect Notion"}
        </span>
        {connection && <Check className="w-3.5 h-3.5 ml-1" weight="bold" />}
      </Button>

      <NotionConnectModal
        open={showModal}
        onOpenChange={setShowModal}
        isConnected={!!connection}
      />
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

  const connect = useMutation(api.notion.connect);
  const disconnect = useMutation(api.notion.disconnect);
  const testConnection = useMutation(api.notion.testConnection);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!integrationToken.trim() || !databaseId.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Test the connection first
      const result = await testConnection({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
      });

      if (!result.success) {
        setError(result.error || "Failed to connect to Notion");
        return;
      }

      // Save the connection
      await connect({
        integrationToken: integrationToken.trim(),
        databaseId: databaseId.trim(),
        targetSection: targetSection.trim() || "Vid It",
      });

      // Reset and close
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isConnected ? "Notion Connection" : "Connect to Notion"}
          </DialogTitle>
        </DialogHeader>

        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-md">
              <Check className="w-5 h-5 text-primary" weight="bold" />
              <div>
                <p className="font-medium text-sm text-primary">
                  Connected to Notion
                </p>
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
                placeholder="secret_..."
              />
              <p className="text-xs text-muted-foreground">
                Create an integration at{" "}
                <a
                  href="https://www.notion.so/my-integrations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  notion.so/my-integrations
                </a>
              </p>
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
                placeholder="abc123..."
              />
              <p className="text-xs text-muted-foreground">
                Copy the ID from your Notion database URL
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="section">Target Section Name</Label>
              <Input
                id="section"
                type="text"
                value={targetSection}
                onChange={(e) => setTargetSection(e.target.value)}
                placeholder="Vid It (default)"
              />
              <p className="text-xs text-muted-foreground">
                The name of the status/section in your Notion database where
                items should be added
              </p>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !integrationToken.trim() || !databaseId.trim() || isSubmitting
                }
              >
                {isSubmitting && (
                  <SpinnerGap className="w-4 h-4 mr-1.5 animate-spin" />
                )}
                {isSubmitting ? "Connecting..." : "Connect"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
