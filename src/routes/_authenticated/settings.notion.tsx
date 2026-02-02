import { useOrganization } from "@clerk/tanstack-react-start";
import {
	CheckCircleIcon,
	NotionLogoIcon,
	SpinnerIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

	const [token, setToken] = useState("");
	const [isTestingToken, setIsTestingToken] = useState(false);
	const [isSavingToken, setIsSavingToken] = useState(false);
	const [testResult, setTestResult] = useState<{
		success: boolean;
		workspaceName?: string;
		error?: string;
	} | null>(null);

	const [databases, setDatabases] = useState<DatabaseOption[]>([]);
	const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
	const [isSavingDatabase, setIsSavingDatabase] = useState(false);

	const testConnection = useAction(api.notion.testConnection);
	const saveIntegrationToken = useMutation(api.notion.saveIntegrationToken);
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
							<CheckCircleIcon
								className="w-5 h-5 text-primary"
								weight="fill"
							/>
							<div>
								<p className="font-medium text-primary">
									Connected
								</p>
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

	const handleTestToken = async () => {
		if (!token.trim()) {
			toast.error("Please enter an integration token");
			return;
		}

		setIsTestingToken(true);
		setTestResult(null);

		try {
			const result = await testConnection({ integrationToken: token.trim() });
			setTestResult(result);
			if (result.success) {
				toast.success(`Connected to ${result.workspaceName}`);
			} else {
				toast.error(result.error || "Failed to connect");
			}
		} catch (error) {
			setTestResult({
				success: false,
				error:
					error instanceof Error ? error.message : "Failed to test connection",
			});
			toast.error("Failed to test connection");
		} finally {
			setIsTestingToken(false);
		}
	};

	const handleSaveToken = async () => {
		if (!token.trim() || !organizationId) {
			toast.error("Please enter an integration token");
			return;
		}

		setIsSavingToken(true);

		try {
			await saveIntegrationToken({
				organizationId,
				integrationToken: token.trim(),
			});
			toast.success("Integration token saved");
			setToken("");
			setTestResult(null);
			await handleLoadDatabases();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to save token",
			);
		} finally {
			setIsSavingToken(false);
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
			toast.error(
				error instanceof Error ? error.message : "Failed to load databases",
			);
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
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to save database settings",
			);
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
			toast.error(
				error instanceof Error ? error.message : "Failed to disconnect",
			);
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
							<CheckCircleIcon
								className="w-5 h-5 text-primary"
								weight="fill"
							/>
							<div>
								<p className="font-medium text-primary">
									Connected
								</p>
								{connectionStatus.databaseName && (
									<p className="text-sm text-muted-foreground">
										{connectionStatus.databaseName}
									</p>
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
								{isLoadingDatabases ? (
									<SpinnerIcon className="w-4 h-4 animate-spin" />
								) : (
									"Change"
								)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleDisconnect}
							>
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
						<Label htmlFor="token">Integration Token</Label>
						<Input
							id="token"
							type="password"
							placeholder="secret_..."
							value={token}
							onChange={(e) => setToken(e.target.value)}
						/>
						<p className="text-xs text-muted-foreground">
							Get your token from{" "}
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

					{testResult && (
						<div
							className={`flex items-center gap-2 text-sm ${
								testResult.success ? "text-primary" : "text-destructive"
							}`}
						>
							{testResult.success ? (
								<>
									<CheckCircleIcon className="w-4 h-4" weight="fill" />
									<span>Connected to {testResult.workspaceName}</span>
								</>
							) : (
								<>
									<XCircleIcon className="w-4 h-4" weight="fill" />
									<span>{testResult.error}</span>
								</>
							)}
						</div>
					)}

					<div className="flex gap-3">
						<Button
							variant="outline"
							onClick={handleTestToken}
							disabled={isTestingToken || !token.trim()}
						>
							{isTestingToken ? (
								<>
									<SpinnerIcon className="w-4 h-4 animate-spin mr-2" />
									Testing...
								</>
							) : (
								"Test"
							)}
						</Button>
						<Button
							onClick={handleSaveToken}
							disabled={
								isSavingToken || !token.trim() || !testResult?.success
							}
						>
							{isSavingToken ? (
								<>
									<SpinnerIcon className="w-4 h-4 animate-spin mr-2" />
									Saving...
								</>
							) : (
								"Save"
							)}
						</Button>
					</div>
				</div>
			)}

			{/* Select Database Prompt (shown after token is saved but no database selected) */}
			{connectionStatus?.isConnected && !connectionStatus.databaseId && (
				<div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
					<div className="flex items-center gap-3">
						<WarningCircleIcon
							className="w-5 h-5 text-amber-500"
							weight="fill"
						/>
						<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
							Select a database to continue
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
