import { SignInButton } from "@clerk/tanstack-react-start";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import ClerkHeader from "@/integrations/clerk/header-user";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div className="min-h-screen bg-background">
			<div className="px-4 py-6 space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-xl font-black font-mono">ideathing</span>
					</div>
					<div className="flex items-center gap-3">
						<Authenticated>
							<Button asChild size="sm" variant="outline">
								<Link to="/recorded">Recorded</Link>
							</Button>
							<NotionConnect />
							<ThemeToggle />
							<ClerkHeader />
						</Authenticated>
						<Unauthenticated>
							<SignInButton />
						</Unauthenticated>
					</div>
				</div>

				<KanbanBoard />
			</div>
		</div>
	);
}
