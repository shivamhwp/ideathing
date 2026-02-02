import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { GearIcon } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export default function HeaderUser() {
	return (
		<div className="flex items-center gap-4">
			<SignedIn>
				<Button asChild variant="ghost" size="icon">
					<Link to="/settings/profile">
						<GearIcon className="w-5 h-5" />
					</Link>
				</Button>
			</SignedIn>
			<SignedOut>
				<SignInButton mode="modal">sign in with github</SignInButton>
			</SignedOut>
		</div>
	);
}
