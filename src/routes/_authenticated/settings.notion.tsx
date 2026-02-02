import { useOrganization } from "@clerk/tanstack-react-start";
import {
  CheckCircleIcon,
  NotionLogoIcon,
  SpinnerIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/settings/notion")({
  component: NotionSettings,
});

type DatabaseOption = {
  id: string;
  name: string;
};

function NotionSettings() {
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const organizationId = organization?.id;
  const connectionStatus = useQuery(
    api.notion.getConnectionStatus,
    organizationId ? { organizationId } : "skip",
  );

  const isAdmin = membership?.role === "org:admin";

  const [isConnecting, setIsConnecting] = useState(false);
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);

  const generateOAuthUrl = useQuery(
    api.notion.generateOAuthUrl,
    organizationId ? { organizationId } : "skip",
  );
  const listDatabases = useAction(api.notion.listDatabases);
  const saveDatabaseSettings = useMutation(api.notion.saveDatabaseSettings);
  const getDataSourceSchema = useAction(api.notion.getDataSourceSchema);
  const disconnect = useMutation(api.notion.disconnect);

  if (!isOrgLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon className="w-6 h-6 text-muted-foreground animate-spin" />
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
                    Syncing with: {connectionStatus.databaseName}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const handleConnectOAuth = () => {
    if (!organizationId) {
      toast.error("No organization context");
      return;
    }

    setIsConnecting(true);

    // Redirect to OAuth URL
    if (generateOAuthUrl) {
      window.location.href = generateOAuthUrl;
    } else {
      toast.error("Failed to generate OAuth URL");
      setIsConnecting(false);
    }
  };

  const handleLoadDatabases = async () => {
    setIsLoadingDatabases(true);
    if (!organizationId) {
      toast.error("No organization ID");
      return;
    }
    try {
      const result = await listDatabases({ organizationId: organizationId });
      setDatabases(result.databases as DatabaseOption[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load databases");
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  const handleSelectDatabase = async (db: DatabaseOption) => {
    setIsSavingDatabase(true);

    if (!organizationId) {
      toast.error("No organization ID");
      return;
    }
    try {
      const schema = await getDataSourceSchema({
        organizationId: organizationId,
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
      await disconnect();
      setDatabases([]);
      toast.success("Disconnected from Notion");
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
              Connect your Notion workspace to sync ideas.
            </p>
          </div>
        </div>
      </div>

      {/* Connected State */}
      {connectionStatus?.isConnected ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircleIcon className="w-5 h-5 text-primary" weight="fill" />
              <div>
                <p className="font-medium text-primary">Connected</p>
                {connectionStatus.databaseName && (
                  <p className="text-sm text-muted-foreground">{connectionStatus.databaseName}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
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
            </div>
          </div>

          {databases.length > 0 && (
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
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
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Connect your Notion workspace via OAuth to sync ideas bidirectionally.
            </p>
          </div>

          <Button onClick={handleConnectOAuth} disabled={isConnecting} size="lg">
            {isConnecting ? (
              <>
                <SpinnerIcon className="w-4 h-4 animate-spin mr-2" />
                Connecting...
              </>
            ) : (
              <>
                <NotionLogoIcon className="w-5 h-5 mr-2" weight="fill" />
                Connect with Notion
              </>
            )}
          </Button>
        </div>
      )}

      {/* Select Database Prompt (shown after connection but no database selected) */}
      {connectionStatus?.isConnected && !connectionStatus.databaseId && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex items-center gap-3">
            <WarningCircleIcon className="w-5 h-5 text-amber-500" weight="fill" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Select a database to continue
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
