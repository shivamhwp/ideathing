import { useOrganization } from "@clerk/tanstack-react-start";
import { NotionLogoIcon, SpinnerIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
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
  const { organization, membership } = useOrganization();
  const organizationId = organization?.id;
  const isAdmin = membership?.role === "org:admin";

  const connection = useQuery(
    api.notion.getConnection,
    organizationId ? { organizationId } : "skip",
  );
  const connectionStatus = useQuery(
    api.notion.getConnectionStatus,
    organizationId ? { organizationId } : "skip",
  );

  if (connection === undefined || connectionStatus === undefined) {
    return null;
  }

  // Not connected - show button to go to settings
  if (!connectionStatus?.isConnected) {
    return <NotionConnectButton />;
  }

  return (
    <NotionConnectDropdown
      connection={connection}
      isAdmin={isAdmin}
      organizationId={organizationId}
    />
  );
}

function NotionConnectButton() {
  const navigate = useNavigate();

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => navigate({ to: "/settings/notion" })}
      className="h-9 w-9 cursor-pointer rounded-lg border-dashed border-border hover:bg-muted/50"
    >
      <NotionLogoIcon
        className="w-4 h-4 text-muted-foreground hover:text-foreground"
        weight="fill"
      />
    </Button>
  );
}

function NotionConnectDropdown({
  connection,
  isAdmin,
  organizationId,
}: {
  connection: NotionConnection | null;
  isAdmin?: boolean;
  organizationId?: string;
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
      if (!organizationId) {
        toast.error("No organization context");
        return;
      }
      const result = await listDatabases({ organizationId });
      setDatabases(result.databases as DatabaseOption[]);
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
    if (!isAdmin || !organizationId) return;

    setIsSubmitting(true);

    try {
      const schema = await getDataSourceSchema({
        organizationId,
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
    <Button variant="secondary" size="icon" className="cursor-pointer">
      <NotionLogoIcon
        className={cn(
          "w-4 h-4 transition-colors",
          hasDatabase
            ? "text-foreground/70 hover:text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
        weight="fill"
      />
    </Button>
  );

  const databaseList = isLoadingDatabases ? (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
      <SpinnerIcon className="w-3 h-3 animate-spin" />
      <span>Loading databases...</span>
    </div>
  ) : (
    <div className="flex flex-col gap-1">
      {databases.map((db) => (
        <DropdownMenuItem
          key={db.id}
          onClick={() => handleSelectDatabase(db)}
          disabled={isSubmitting || !isAdmin}
          className={`cursor-pointer hover:bg-muted/50 focus:bg-muted/50 ${connection?.databaseId === db.id ? "bg-primary/25" : ""}`}
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
          Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
