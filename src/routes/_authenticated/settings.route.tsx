import { ArrowLeftIcon } from "@phosphor-icons/react";
import { List, Root, Trigger } from "@radix-ui/react-tabs";
import {
	createFileRoute,
	Link,
	Outlet,
	useLocation,
} from "@tanstack/react-router";
import { cn } from "@/utils/utils";

export const Route = createFileRoute("/_authenticated/settings")({
	component: SettingsLayout,
});

function SettingsLayout() {
	const current = useLocation().pathname.split("/")[2] || "profile";

	return (
		<div className="container mx-auto w-full max-w-3xl">
			<Link
				to="/"
				className="inline-flex items-center pt-10 gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeftIcon className="w-4 h-4" />
				back to home
			</Link>
			<Root value={current}>
				<List className="mt-6 flex h-10 items-end gap-6 border-b">
					{(
						[
							{
								key: "profile",
								label: "Profile",
								to: "/settings/profile" as const,
							},
						] as const
					).map((t) => (
						<Trigger
							asChild
							className={cn(
								"inline-flex items-center justify-center whitespace-nowrap border-transparent border-b-2 px-1 pb-2 font-medium text-muted-foreground text-sm transition",
								"hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground",
							)}
							key={t.key}
							value={t.key}
						>
							<Link preload="intent" to={t.to}>
								{t.label}
							</Link>
						</Trigger>
					))}
				</List>

				<div className="mt-4 w-full">
					<Outlet />
				</div>
			</Root>
		</div>
	);
}
