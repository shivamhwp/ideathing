import { ClerkProvider } from "@clerk/tanstack-react-start";
import { shadcn } from "@clerk/themes";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Add your Clerk Publishable Key to the .env.local file");
}

const clerkTheme = {
  ...shadcn,
  cssLayerName: "utilities",
};

const clerkAppearance = {
  theme: clerkTheme,
  variables: {
    colorBackground: "var(--card)",
    colorForeground: "var(--card-foreground)",
    colorInputBackground: "var(--input)",
    colorInputText: "var(--card-foreground)",
    colorPrimary: "var(--primary)",
    colorPrimaryForeground: "var(--primary-foreground)",
    borderRadius: "var(--radius)",
  },
  elements: {
    cardBox: "rounded-xl border border-border/50 bg-card/50 text-card-foreground shadow-sm",
    socialButtonsBlockButton:
      "rounded-md border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
    formFieldInput:
      "rounded-md border border-input bg-transparent text-card-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring",
    formButtonPrimary:
      "rounded-md bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
    footerActionLink: "text-primary hover:text-primary/90",
  },
};

export default function AppClerkProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      afterSignOutUrl="/"
      appearance={clerkAppearance}
    >
      {children}
    </ClerkProvider>
  );
}
