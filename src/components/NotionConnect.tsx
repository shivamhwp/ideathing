import {
	NotionLogoIcon,
	SpinnerGapIcon,
	SpinnerIcon,
} from "@phosphor-icons/react";
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
	const connection = useQuery(api.notion.getConnection);

	if (connection === undefined) {
		return null;
	}

	return <NotionConnectDropdown connection={connection} />;
}

function NotionConnectDropdown({
	connection,
}: {
	connection: NotionConnection | null;
}) {
	const [open, setOpen] = useState(false);
	const [databases, setDatabases] = useState<DatabaseOption[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);

	const createOAuthState = useMutation(api.notion.createOAuthState);
	const saveDatabaseSettings = useMutation(api.notion.saveDatabaseSettings);
	const disconnect = useMutation(api.notion.disconnect);
	const listDatabases = useAction(api.notion.listDatabases);
	const getDataSourceSchema = useAction(api.notion.getDataSourceSchema);

	const isConnected = !!connection;
	const hasDatabase = !!connection?.databaseId;

	const loadDatabases = async () => {
		setIsLoadingDatabases(true);
		try {
			const result = await listDatabases();
			setDatabases(result.databases as DatabaseOption[]);
		} catch (err) {
		} finally {
			setIsLoadingDatabases(false);
		}
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (nextOpen && isConnected) {
			void loadDatabases();
		}
		setOpen(nextOpen);
	};

	const handleStartOAuth = async () => {
		setIsSubmitting(true);
		try {
			const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
			const redirectUri =
				import.meta.env.VITE_NOTION_OAUTH_REDIRECT_URI ??
				`${window.location.origin}/notion/callback`;

			if (!clientId) {
				toast.error("Missing VITE_NOTION_CLIENT_ID env var.");
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
			toast.error(
				err instanceof Error ? err.message : "Failed to start OAuth.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSelectDatabase = async (db: DatabaseOption) => {
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
			toast.error(
				err instanceof Error ? err.message : "Failed to save settings.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDisconnect = async () => {
		await disconnect();
		setOpen(false);
	};

	if (!isConnected) {
		return (
			<Button
				variant="outline"
				size="icon"
				onClick={handleStartOAuth}
				disabled={isSubmitting}
				className="h-9 w-9 rounded-lg border-dashed border-border hover:bg-muted/50"
			>
				{isSubmitting ? (
					<SpinnerGapIcon className="w-4 h-4 animate-spin" />
				) : (
					<NotionLogoIcon
						className="w-4 h-4 text-muted-foreground hover:text-foreground"
						weight="fill"
					/>
				)}
			</Button>
		);
	}

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
					disabled={isSubmitting}
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
				{databaseList}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					onClick={handleDisconnect}
					className="text-destructive w-full cursor-pointer hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
				>
					Disconnect
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
