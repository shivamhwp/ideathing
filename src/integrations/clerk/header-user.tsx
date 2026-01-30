import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export default function HeaderUser() {
  return (
    <div className="flex items-center gap-4">
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <SignInButton />
      </SignedOut>
    </div>
  );
}
