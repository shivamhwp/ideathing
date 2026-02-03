import { useOrganization } from "@clerk/tanstack-react-start";
import { convexQuery } from "@convex-dev/react-query";
import { NotionLogoIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const { membership } = useOrganization();
  const isAdmin = membership?.role === "org:admin";

  const { data: connection, isLoading: isConnectionLoading } = useQuery(
    convexQuery(api.notion.getConnection, {}),
  );
  const { data: connectionStatus, isLoading: isStatusLoading } = useQuery(
    convexQuery(api.notion.getConnectionStatus, {}),
  );

  // Not connected - show button to go to settings
  if (isConnectionLoading || isStatusLoading) {
    return null;
  }

  if (!connectionStatus?.isConnected) {
    return <NotionConnectButton />;
  }

  return <NotionConnectDropdown connection={connection ?? null} isAdmin={isAdmin} />;
}

function NotionConnectButton() {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigate({ to: "/settings/notion" })}
      className="h-9 w-9 cursor-pointer rounded-lg border-dashed border-border"
    >
      <NotionLogoIcon className="w-4 h-4 " weight="fill" />
    </Button>
  );
}

function NotionConnectDropdown({
  connection,
  isAdmin,
}: {
  connection: NotionConnection | null;
  isAdmin?: boolean;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [databases, setDatabases] = useState<DatabaseOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

  const saveDatabaseSettings = useMutation(api.notion.saveDatabaseSettings);
  const listDatabases = useAction(api.notion.listDatabases);
  const getDataSourceSchema = useAction(api.notion.getDataSourceSchema);

  const hasDatabase = !!connection?.databaseId;

  const loadDatabases = async () => {
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && isAdmin) {
      void loadDatabases();
    }
    setOpen(nextOpen);
  };

  const handleSelectDatabase = async (db: DatabaseOption) => {
    if (!isAdmin) return;

    setIsSubmitting(true);

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
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerButton = (
    <Button variant="secondary" size="icon" className="cursor-pointer bg-primary/10">
      <NotionLogoIcon
        className={cn("w-4 h-4", hasDatabase ? "" : "text-muted-foreground hover:text-foreground")}
        weight="fill"
      />
    </Button>
  );

  const databaseList = isLoadingDatabases ? (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
      <span className="h-6 items-center flex  gap-2 justify-center">
        <SpinnerIcon className="w-4 h-4 animate-spin" />
        Loading databases...
      </span>
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      {databases.map((db) => (
        <DropdownMenuItem
          key={db.id}
          onClick={() => handleSelectDatabase(db)}
          disabled={isSubmitting || !isAdmin}
          className={`cursor-pointer hover:bg-muted/50 focus:bg-muted/50 ${connection?.databaseId === db.id ? "bg-primary/15" : ""}`}
        >
          {db.name}
        </DropdownMenuItem>
      ))}
    </div>
  );

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isAdmin ? (
          databaseList
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {connection?.databaseName || "Connected to Notion"}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setOpen(false);
            navigate({ to: "/settings/notion" });
          }}
          className="cursor-pointer"
        >
          Notion Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
