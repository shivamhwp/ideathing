import { useOrganization } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import {
  CheckCircleIcon,
  NotionLogoIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useTheoMode } from "@/hooks/useTheoMode";

export const Route = createFileRoute("/_authenticated/settings/notion")({
  component: NotionSettings,
});

type DatabaseOption = {
  id: string;
  name: string;
};

function NotionSettings() {
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const { isTheoMode, isCheckingMode } = useTheoMode();
  const { data: connectionStatus } = useQuery({
    ...convexQuery(api.notion.queries.getConnectionStatus, {}),
    enabled: isTheoMode,
  });

  const isAdmin = membership?.role === "org:admin";

  const [isConnecting, setIsConnecting] = useState(false);
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);

  const generateOAuthUrl = useAction(api.notion.actions.generateOAuthUrl);
  const listDatabases = useAction(api.notion.actions.listDatabases);
  const saveDatabaseSettings = useMutation(api.notion.mutations.saveDatabaseSettings);
  const getDataSourceSchema = useAction(api.notion.actions.getDataSourceSchema);
  const disconnect = useAction(api.notion.actions.disconnect);

  if (!isOrgLoaded || isCheckingMode) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!isTheoMode) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <WarningCircleIcon className="w-5 h-5" />
          <p>
            Theo mode is disabled for this organization. Enable `modeSettings.theoMode` in Convex
            dashboard to use Notion integration.
          </p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <WarningCircleIcon className="w-5 h-5" />
          <p>You need to be part of an organization to configure Notion.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border/50 bg-card/50 p-6">
          <div className="flex items-center gap-4">
            <NotionLogoIcon className="w-8 h-8" weight="fill" />
            <div>
              <h2 className="text-lg font-semibold">Notion Integration</h2>
              <p className="text-sm text-muted-foreground">
                Only organization admins can configure Notion settings.
              </p>
            </div>
          </div>
        </div>

        {connectionStatus?.isConnected && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-primary" weight="fill" />
              <div>
                <p className="font-medium text-primary">Connected</p>
                {connectionStatus.databaseName && (
                  <p className="text-sm text-muted-foreground">
                    Notion destination: {connectionStatus.databaseName}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleConnectOAuth = async () => {
    setIsConnecting(true);
    try {
      const authUrl = await generateOAuthUrl({});
      window.location.href = authUrl;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate OAuth URL");
      setIsConnecting(false);
    }
  };

  const handleLoadDatabases = async () => {
    setIsLoadingDatabases(true);
    try {
      const result = await listDatabases({});
      setDatabases(result.databases);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load databases");
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const handleSelectDatabase = async (db: DatabaseOption) => {
    setIsSavingDatabase(true);

    try {
      const schema = await getDataSourceSchema({
        dataSourceId: db.id,
      });
      await saveDatabaseSettings({
        databaseId: db.id,
        databaseName: db.name,
        targetSection: "To Stream",
        titlePropertyName: schema.titlePropertyName,
        statusPropertyName: schema.statusPropertyName,
        statusPropertyType: schema.statusPropertyType as "status" | "select",
        descriptionPropertyName: schema.descriptionPropertyName,
      });
      toast.success(`Connected to ${db.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save database settings");
    } finally {
      setIsSavingDatabase(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect({});
      setDatabases([]);
      toast.success("Disconnected from Notion.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border/50 bg-card/50 p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <NotionLogoIcon className="w-8 h-8" weight="fill" />
          <div>
            <h2 className="text-lg font-semibold">Notion Integration</h2>
            <p className="text-sm text-muted-foreground">
              {connectionStatus?.isConnected ? "Connected" : "Disconnected"}
            </p>
            {connectionStatus?.databaseName && (
              <p className="text-xs text-muted-foreground mt-1">
                Database: {connectionStatus.databaseName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus?.isConnected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadDatabases}
                disabled={isLoadingDatabases}
              >
                {isLoadingDatabases ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : "Change"}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={handleConnectOAuth} disabled={isConnecting} size="sm">
              {isConnecting ? (
                <>
                  <SpinnerIcon className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <NotionLogoIcon className="w-5 h-5 mr-2" weight="fill" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Connected State */}
      {connectionStatus?.isConnected ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-5 h-5 text-primary" weight="fill" />
            <p className="text-sm text-muted-foreground">Workspace connected</p>
          </div>

          {databases.length > 0 && (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {databases.map((db) => (
                <Button
                  variant="ghost"
                  size="sm"
                  key={db.id}
                  onClick={() => handleSelectDatabase(db)}
                  disabled={isSavingDatabase}
                  className="justify-start"
                >
                  <span className="text-sm">{db.name}</span>
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <WarningCircleIcon className="w-5 h-5" />
            <p>Connect Notion to send ideas from Theo mode.</p>
          </div>
        </div>
      )}

      {/* Select Database Prompt (shown after connection but no database selected) */}
      {connectionStatus?.isConnected && !connectionStatus.databaseId && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex items-center gap-3">
            <WarningCircleIcon className="w-5 h-5 text-amber-500" weight="fill" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Select a database to enable sending ideas.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
