import {
  ArrowSquareOutIcon,
  CheckIcon,
  InfoIcon,
  NotionLogoIcon,
  SpinnerGapIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select-new";
import { cn } from "@/utils/utils";

type NotionConnection = {
  databaseId?: string | null;
  databaseName?: string | null;
  targetSection?: string | null;
  titlePropertyName?: string | null;
  statusPropertyName?: string | null;
  statusPropertyType?: "status" | "select" | null;
  descriptionPropertyName?: string | null;
};

type DatabaseOption = {
  id: string;
  name: string;
};

export function NotionConnect() {
  const connection = useQuery(api.notion.getConnection);

  if (connection === undefined) {
    return null;
  }

  return <NotionConnectModal connection={connection} />;
}

function NotionConnectModal({ connection }: { connection: NotionConnection | null }) {
  const [open, setOpen] = useState(false);
  const [targetSection, setTargetSection] = useState(connection?.targetSection ?? "To Stream");
  const [titlePropertyName, setTitlePropertyName] = useState(
    connection?.titlePropertyName ?? "Name",
  );
  const [statusPropertyName, setStatusPropertyName] = useState(
    connection?.statusPropertyName ?? "Status",
  );
  const [statusPropertyType, setStatusPropertyType] = useState<"status" | "select">(
    connection?.statusPropertyType ?? "status",
  );
  const [descriptionPropertyName, setDescriptionPropertyName] = useState(
    connection?.descriptionPropertyName ?? "Description",
  );
  const [selectedDatabaseId, setSelectedDatabaseId] = useState(connection?.databaseId ?? "");
  const [selectedDatabaseName, setSelectedDatabaseName] = useState(connection?.databaseName ?? "");
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isDetectingSchema, setIsDetectingSchema] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);

  const createOAuthState = useMutation(api.notion.createOAuthState);
  const saveDatabaseSettings = useMutation(api.notion.saveDatabaseSettings);
  const disconnect = useMutation(api.notion.disconnect);
  const listDatabases = useAction(api.notion.listDatabases);
  const getDataSourceSchema = useAction(api.notion.getDataSourceSchema);

  const isConnected = !!connection;
  const hasDatabase = !!connection?.databaseId;

  const databaseOptions = useMemo(
    () => databases.map((db) => ({ value: db.id, label: db.name })),
    [databases],
  );

  const initializeFromConnection = () => {
    setAutoSaved(false);
    setTargetSection(connection?.targetSection ?? "To Stream");
    setTitlePropertyName(connection?.titlePropertyName ?? "Name");
    setStatusPropertyName(connection?.statusPropertyName ?? "Status");
    setStatusPropertyType(connection?.statusPropertyType ?? "status");
    setDescriptionPropertyName(connection?.descriptionPropertyName ?? "Description");
    setSelectedDatabaseId(connection?.databaseId ?? "");
    setSelectedDatabaseName(connection?.databaseName ?? "");
    setDatabases([]);
    setError(null);
    setShowHelp(false);
  };

  const detectSchema = async (dataSourceId: string) => {
    setIsDetectingSchema(true);
    setError(null);
    try {
      const result = await getDataSourceSchema({
        dataSourceId,
      });
      setTitlePropertyName(result.titlePropertyName);
      setStatusPropertyName(result.statusPropertyName);
      setStatusPropertyType(result.statusPropertyType as "status" | "select");
      setDescriptionPropertyName(result.descriptionPropertyName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to detect Notion database properties.");
    } finally {
      setIsDetectingSchema(false);
    }
  };

  const loadDatabases = async () => {
    if (!connection) return;
    setIsLoadingDatabases(true);
    setError(null);
    try {
      const result = await listDatabases();
      const list = result.databases as DatabaseOption[];
      setDatabases(list);

      let nextDatabaseId = selectedDatabaseId;
      let nextDatabaseName = selectedDatabaseName;
      if (!nextDatabaseId) {
        const preferred = list.find((db) => db.name.toLowerCase() === "content planning");
        const fallback = preferred ?? list[0];
        if (fallback) {
          nextDatabaseId = fallback.id;
          nextDatabaseName = fallback.name;
          setSelectedDatabaseId(nextDatabaseId);
          setSelectedDatabaseName(nextDatabaseName);
        }
      }

      if (nextDatabaseId) {
        await detectSchema(nextDatabaseId);
      }

      if (!connection.databaseId && list.length === 1 && nextDatabaseId && !autoSaved) {
        setAutoSaved(true);
        await saveDatabaseSettings({
          databaseId: nextDatabaseId,
          databaseName: nextDatabaseName,
          targetSection: targetSection.trim() || "To Stream",
          titlePropertyName: titlePropertyName.trim() || "Name",
          statusPropertyName: statusPropertyName.trim() || "Status",
          statusPropertyType,
          descriptionPropertyName: descriptionPropertyName.trim() || "Description",
        });
        setOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Notion databases.");
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      initializeFromConnection();
      void loadDatabases();
    }
    setOpen(nextOpen);
  };

  const handleStartOAuth = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID as string | undefined;
      const redirectUri =
        (import.meta.env.VITE_NOTION_OAUTH_REDIRECT_URI as string | undefined) ??
        `${window.location.origin}/notion/callback`;

      if (!clientId) {
        setError("Missing VITE_NOTION_CLIENT_ID env var.");
        return;
      }

      const { state } = await createOAuthState();
      const url = new URL("https://api.notion.com/v1/oauth/authorize");
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("owner", "user");
      url.searchParams.set("state", state);

      window.location.href = url.toString();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start Notion OAuth.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatabaseId) {
      setError("Please choose a Notion database.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await saveDatabaseSettings({
        databaseId: selectedDatabaseId,
        databaseName: selectedDatabaseName,
        targetSection: targetSection.trim() || "To Stream",
        titlePropertyName: titlePropertyName.trim() || "Name",
        statusPropertyName: statusPropertyName.trim() || "Status",
        statusPropertyType,
        descriptionPropertyName: descriptionPropertyName.trim() || "Description",
      });
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save Notion settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setOpen(false);
  };

  const handleDatabaseChange = (value: string) => {
    setSelectedDatabaseId(value);
    const match = databases.find((db) => db.id === value);
    setSelectedDatabaseName(match?.name ?? "");
    if (value) {
      void detectSchema(value);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        variant={isConnected ? "outline" : "secondary"}
        size="sm"
        onClick={() => handleOpenChange(true)}
        className={cn(
          isConnected &&
            " cursor-pointer border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
        )}
      >
        <NotionLogoIcon className="w-4 h-4 mr-1.5" weight="fill" />
        <span className="text-xs">{hasDatabase ? "Connected" : "Connect Notion"}</span>
        {hasDatabase && <CheckIcon className="w-4 h-4 ml-1" weight="bold" />}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isConnected ? "Notion Connection" : "Connect to Notion"}</DialogTitle>
          {!isConnected && (
            <DialogDescription>
              Connect your Notion workspace to sync ideas when you move them to "To Stream".
            </DialogDescription>
          )}
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive rounded-md">
            <WarningCircleIcon className="w-4 h-4 flex-shrink-0" weight="fill" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {!isConnected ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <InfoIcon className="w-4 h-4" />
              <span>{showHelp ? "Hide" : "Show"} setup instructions</span>
            </button>

            {showHelp && (
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-2">
                    1. Create a public Notion integration
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                    <li>
                      Go to{" "}
                      <a
                        href="https://www.notion.so/profile/integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5"
                      >
                        notion.so/profile/integrations
                        <ArrowSquareOutIcon className="w-3 h-3" />
                      </a>
                    </li>
                    <li>Click "New integration" → choose "Public"</li>
                    <li>Enable "Insert content" capability</li>
                    <li>Add your OAuth redirect URL</li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">
                    2. Share your database with the integration
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                    <li>Open the database you want to sync</li>
                    <li>Click "..." → "Connections"</li>
                    <li>Select your integration from the list</li>
                  </ol>
                </div>

                <div>
                  <p className="font-medium text-foreground mb-2">3. (Optional) Enable webhooks</p>
                  <p className="text-xs text-muted-foreground">
                    Follow the in-app guide to keep properties in sync.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link to="/notion/webhooks">Open webhook setup</Link>
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={handleStartOAuth} disabled={isSubmitting} className="w-full">
              {isSubmitting && <SpinnerIcon className="w-4 h-4 mr-1.5 animate-spin" />}
              {isSubmitting ? "Redirecting..." : "Connect Notion"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSaveDatabase} className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-md">
              <CheckIcon className="w-5 h-5 text-primary" weight="bold" />
              <div>
                <p className="font-medium text-sm text-primary">Connected to Notion</p>
                <p className="text-xs text-primary/70">
                  Choose a database to sync your "move to To Stream" ideas.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="database">Database</Label>
              {isLoadingDatabases ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                  Loading databases...
                </div>
              ) : (
                <Select value={selectedDatabaseId} onValueChange={handleDatabaseChange}>
                  <SelectTrigger id="database">
                    <SelectValue placeholder="Select a database" />
                  </SelectTrigger>
                  <SelectContent>
                    {databaseOptions.map((db) => (
                      <SelectItem key={db.value} value={db.value}>
                        {db.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                We will preselect "Content Planning" if it exists. Property names are auto-detected.
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {isDetectingSchema
                ? "Detecting Notion properties…"
                : `Using ${titlePropertyName}, ${statusPropertyName} (${statusPropertyType}), and ${descriptionPropertyName}.`}
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedDatabaseId}>
                {isSubmitting && <SpinnerGapIcon className="w-4 h-4 mr-1.5 animate-spin" />}
                {isSubmitting ? "Saving..." : hasDatabase ? "Update" : "Save"}
              </Button>
            </DialogFooter>

            <Button
              variant="outline"
              onClick={handleDisconnect}
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              type="button"
            >
              Disconnect
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
