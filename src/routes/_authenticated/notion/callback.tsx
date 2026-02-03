import { CheckCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { api } from "convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";

type NotionCallbackSearch = {
	code?: string;
	state?: string;
	error?: string;
};

type NotionCallbackData = {
	status: "success" | "error";
	errorMessage?: string;
};

export const Route = createFileRoute("/_authenticated/notion/callback")({
	component: NotionCallback,
});

function NotionCallback() {
	const params = useSearch({
		from: "/_authenticated/notion/callback",
	}) as NotionCallbackSearch;
	const navigate = useNavigate();
	const [loaderData, setLoaderData] = useState<NotionCallbackData | null>(null);
	const exchangeOAuthCodeMutation = useAction(api.notion.exchangeOAuthCode);
	const exchangeAttempted = useRef(false);

	// Exchange OAuth code on mount
	useEffect(() => {
		// Prevent double execution in React Strict Mode
		if (exchangeAttempted.current) return;
		exchangeAttempted.current = true;

		const code = params.code;
		const state = params.state;
	const error = params.error;

		const setStatusAndRedirect = (
			status: "success" | "error",
			errorMessage?: string,
		) => {
			setLoaderData({ status, errorMessage });
			const delay = status === "success" ? 2000 : 3000;
			setTimeout(() => {
				void navigate({ to: "/settings/notion" });
			}, delay);
		};

		// Handle Notion errors (user denied access, etc)
		if (error) {
			setStatusAndRedirect("error", error);
			return;
		}

		// Handle missing params
		if (!code || !state) {
			setStatusAndRedirect("error", "missing_code_or_state");
			return;
		}

		// Exchange code for tokens
		exchangeOAuthCodeMutation({ code, state })
			.then(() => setStatusAndRedirect("success"))
			.catch((err) => {
				console.error("OAuth exchange error:", err);
				setStatusAndRedirect("error", "exchange_failed");
			});
	}, [
		params.code,
		params.state,
		params.error,
		exchangeOAuthCodeMutation,
		navigate,
	]);

	if (!loaderData) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
				<div className="max-w-md text-center space-y-4">
					<div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
					<p className="text-lg font-medium">Processing OAuth callback...</p>
				</div>
			</div>
		);
	}

	const errorMessages: Record<string, string> = {
		access_denied: "You denied access to Notion",
		exchange_failed: "Failed to exchange authorization code",
		missing_code_or_state: "Missing required OAuth parameters",
		invalid_state: "Invalid OAuth state",
	};

	const errorMessage =
		loaderData.status === "error"
			? errorMessages[loaderData.errorMessage || ""] ||
				"An unknown error occurred"
			: "";

	return (
		<div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
			<div className="max-w-md text-center space-y-4">
				{loaderData.status === "success" && (
					<>
						<CheckCircleIcon
							className="w-12 h-12 text-green-500 mx-auto"
							weight="fill"
						/>
						<p className="text-lg font-medium text-green-600">
							Successfully connected to Notion!
						</p>
						<p className="text-sm text-muted-foreground">
							Redirecting to settings...
						</p>
					</>
				)}

				{loaderData.status === "error" && (
					<>
						<XCircleIcon
							className="w-12 h-12 text-destructive mx-auto"
							weight="fill"
						/>
						<p className="text-lg font-medium text-destructive">
							Connection failed
						</p>
						<p className="text-sm text-muted-foreground">{errorMessage}</p>
						<p className="text-xs text-muted-foreground">
							Redirecting to settings...
						</p>
					</>
				)}
			</div>
		</div>
	);
}
