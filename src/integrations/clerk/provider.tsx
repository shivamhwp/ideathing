import { ClerkProvider } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/themes";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CLERK_DOMAIN = import.meta.env.VITE_CLERK_DOMAIN?.trim();
const CLERK_PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL?.trim();
const CLERK_NETWORK_CONFIG = CLERK_PROXY_URL
  ? { proxyUrl: CLERK_PROXY_URL }
  : CLERK_DOMAIN
    ? { domain: CLERK_DOMAIN }
    : {};
const CLERK_APPEARANCE = {
  baseTheme: shadcn,
} as const;

if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env.local file");
}

export default function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      {...CLERK_NETWORK_CONFIG}
      polling={false}
      touchSession={false}
      afterSignOutUrl="/"
      appearance={CLERK_APPEARANCE}
    >
      {children}
    </ClerkProvider>
  );
}
