import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { NotionConnect } from "@/components/NotionConnect";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import ClerkHeader from "@/integrations/clerk/header-user";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div className="h-screen flex flex-col bg-background">
			<div className="px-4 py-6 flex flex-col flex-1 min-h-0 gap-4">
				<div className="flex items-center justify-between ">
					<div className="flex items-center gap-2">
						<span className="text-xl font-black font-mono hover:text-primary transition-colors flex items-center gap-2">
							ideathing
						</span>
					</div>
					<div className="flex items-center gap-3">
						<Authenticated>
							<Button asChild size="sm" variant="ghost">
								<Link to="/recorded">recorded vids</Link>
							</Button>
							<NotionConnect />
							<div className="flex items-center gap-1">
								<ThemeToggle />
								<ClerkHeader />
							</div>
						</Authenticated>
						<Unauthenticated>
							<Button asChild size="sm" variant="default" className="font-mono">
								<SignInButton mode="modal">sign in with google</SignInButton>
							</Button>
						</Unauthenticated>
					</div>
				</div>

				<KanbanBoard />
			</div>
		</div>
	);
}
