import {
	CheckIcon,
	NotionLogoIcon,
	SpinnerGapIcon,
	SpinnerIcon,
	WarningCircleIcon,
} from "@phosphor-icons/react";
import { api } from "convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
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
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

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

function NotionConnectModal({
	connection,
}: {
	connection: NotionConnection | null;
}) {
	const [open, setOpen] = useState(false);
	const [targetSection, setTargetSection] = useState(
		connection?.targetSection ?? "To Stream",
	);
	const [titlePropertyName, setTitlePropertyName] = useState(
		connection?.titlePropertyName ?? "Name",
	);
	const [statusPropertyName, setStatusPropertyName] = useState(
		connection?.statusPropertyName ?? "Status",
	);
	const [statusPropertyType, setStatusPropertyType] = useState<
		"status" | "select"
	>(connection?.statusPropertyType ?? "status");
	const [descriptionPropertyName, setDescriptionPropertyName] = useState(
		connection?.descriptionPropertyName ?? "Description",
	);
	const [selectedDatabaseId, setSelectedDatabaseId] = useState(
		connection?.databaseId ?? "",
	);
	const [selectedDatabaseName, setSelectedDatabaseName] = useState(
		connection?.databaseName ?? "",
	);
	const [databases, setDatabases] = useState<DatabaseOption[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
	const [isDetectingSchema, setIsDetectingSchema] = useState(false);
	const [error, setError] = useState<string | null>(null);

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

	// Auto-save when connection exists but no database is set yet
	useEffect(() => {
		if (isConnected && !hasDatabase && !open) {
			// Automatically open dialog and load databases when newly connected
			void loadDatabasesAndAutoSave();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isConnected, hasDatabase]);

	const loadDatabasesAndAutoSave = async () => {
		if (!connection) return;
		setIsLoadingDatabases(true);
		setError(null);
		try {
			const result = await listDatabases();
			const list = result.databases as DatabaseOption[];
			setDatabases(list);

			// Find preferred database or use first one
			const preferred = list.find(
				(db) => db.name.toLowerCase() === "content planning",
			);
			const fallback = preferred ?? list[0];

			if (fallback) {
				const dbId = fallback.id;
				const dbName = fallback.name;
				setSelectedDatabaseId(dbId);
				setSelectedDatabaseName(dbName);

				// Auto-detect schema
				const schema = await getDataSourceSchema({ dataSourceId: dbId });
				setTitlePropertyName(schema.titlePropertyName);
				setStatusPropertyName(schema.statusPropertyName);
				setStatusPropertyType(schema.statusPropertyType as "status" | "select");
				setDescriptionPropertyName(schema.descriptionPropertyName);

				// Auto-save settings
				await saveDatabaseSettings({
					databaseId: dbId,
					databaseName: dbName,
					targetSection: "To Stream",
					titlePropertyName: schema.titlePropertyName,
					statusPropertyName: schema.statusPropertyName,
					statusPropertyType: schema.statusPropertyType as "status" | "select",
					descriptionPropertyName: schema.descriptionPropertyName,
				});
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to auto-configure Notion.",
			);
			// Open dialog so user can configure manually
			setOpen(true);
		} finally {
			setIsLoadingDatabases(false);
		}
	};

	const initializeFromConnection = () => {
		setTargetSection(connection?.targetSection ?? "To Stream");
		setTitlePropertyName(connection?.titlePropertyName ?? "Name");
		setStatusPropertyName(connection?.statusPropertyName ?? "Status");
		setStatusPropertyType(connection?.statusPropertyType ?? "status");
		setDescriptionPropertyName(
			connection?.descriptionPropertyName ?? "Description",
		);
		setSelectedDatabaseId(connection?.databaseId ?? "");
		setSelectedDatabaseName(connection?.databaseName ?? "");
		setDatabases([]);
		setError(null);
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
			setError(
				err instanceof Error
					? err.message
					: "Failed to detect Notion database properties.",
			);
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
				const preferred = list.find(
					(db) => db.name.toLowerCase() === "content planning",
				);
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
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load Notion databases.",
			);
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
			const clientId = import.meta.env.VITE_NOTION_CLIENT_ID as
				| string
				| undefined;
			const redirectUri =
				(import.meta.env.VITE_NOTION_OAUTH_REDIRECT_URI as
					| string
					| undefined) ?? `${window.location.origin}/notion/callback`;

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
			setError(
				err instanceof Error ? err.message : "Failed to start Notion OAuth.",
			);
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
				descriptionPropertyName:
					descriptionPropertyName.trim() || "Description",
			});
			setOpen(false);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save Notion settings.",
			);
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

	// Compact connected indicator (just icon with tooltip)
	if (hasDatabase) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => handleOpenChange(true)}
							className="h-8 w-8 text-primary hover:bg-primary/10"
						>
							<NotionLogoIcon className="w-4 h-4" weight="fill" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>
						<p>Notion connected: {connection?.databaseName}</p>
					</TooltipContent>
				</Tooltip>

				<Dialog open={open} onOpenChange={handleOpenChange}>
					<DialogContent className="sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>Notion Connection</DialogTitle>
						</DialogHeader>

						{error && (
							<div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive rounded-md">
								<WarningCircleIcon
									className="w-4 h-4 flex-shrink-0"
									weight="fill"
								/>
								<p className="text-xs">{error}</p>
							</div>
						)}

						<form onSubmit={handleSaveDatabase} className="space-y-4">
							<div className="flex items-center gap-3 p-3 bg-primary/10 rounded-md">
								<CheckIcon className="w-5 h-5 text-primary" weight="bold" />
								<div>
									<p className="font-medium text-sm text-primary">
										Connected to Notion
									</p>
									<p className="text-xs text-primary/70">
										Syncing with {connection?.databaseName}
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
									<Select
										value={selectedDatabaseId}
										onValueChange={handleDatabaseChange}
									>
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
							</div>
							<div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
								{isDetectingSchema
									? "Detecting Notion properties…"
									: `Using ${titlePropertyName}, ${statusPropertyName} (${statusPropertyType}), and ${descriptionPropertyName}.`}
							</div>

							<DialogFooter className="gap-2 pt-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => setOpen(false)}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={isSubmitting || !selectedDatabaseId}
								>
									{isSubmitting && (
										<SpinnerGapIcon className="w-4 h-4 mr-1.5 animate-spin" />
									)}
									{isSubmitting ? "Saving..." : "Update"}
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
					</DialogContent>
				</Dialog>
			</TooltipProvider>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<Button
				variant="secondary"
				size="sm"
				onClick={() => handleOpenChange(true)}
			>
				<NotionLogoIcon className="w-4 h-4 mr-1.5" weight="fill" />
				<span className="text-xs">Connect</span>
			</Button>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Connect to Notion</DialogTitle>
					<DialogDescription>
						Connect your Notion workspace to sync ideas when you move them to
						"To Stream".
					</DialogDescription>
				</DialogHeader>

				{error && (
					<div className="flex items-center gap-2 p-2.5 bg-destructive/10 text-destructive rounded-md">
						<WarningCircleIcon
							className="w-4 h-4 flex-shrink-0"
							weight="fill"
						/>
						<p className="text-xs">{error}</p>
					</div>
				)}

				{!isConnected ? (
					<div className="space-y-4">
						<Button
							onClick={handleStartOAuth}
							disabled={isSubmitting}
							className="w-full"
						>
							{isSubmitting && (
								<SpinnerIcon className="w-4 h-4 mr-1.5 animate-spin" />
							)}
							{isSubmitting ? "Redirecting..." : "Connect Notion"}
						</Button>
					</div>
				) : (
					<form onSubmit={handleSaveDatabase} className="space-y-4">
						<div className="flex items-center gap-3 p-3 bg-primary/10 rounded-md">
							<CheckIcon className="w-5 h-5 text-primary" weight="bold" />
							<div>
								<p className="font-medium text-sm text-primary">
									Connected to Notion
								</p>
								<p className="text-xs text-primary/70">
									Choose a database to sync your ideas.
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
								<Select
									value={selectedDatabaseId}
									onValueChange={handleDatabaseChange}
								>
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
						</div>
						<div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
							{isDetectingSchema
								? "Detecting Notion properties…"
								: `Using ${titlePropertyName}, ${statusPropertyName} (${statusPropertyType}), and ${descriptionPropertyName}.`}
						</div>

						<DialogFooter className="gap-2 pt-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isSubmitting || !selectedDatabaseId}
							>
								{isSubmitting && (
									<SpinnerGapIcon className="w-4 h-4 mr-1.5 animate-spin" />
								)}
								{isSubmitting ? "Saving..." : "Save"}
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
