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
    borderRadius: "calc(var(--radius) - 2px)",
  },
  elements: {
    cardBox: {
      backgroundColor: "var(--card)",
      color: "var(--card-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "0.75rem",
      boxShadow: "var(--shadow-sm)",
    },
    socialButtonsBlockButton: {
      border: "1px solid var(--border)",
      borderRadius: "calc(var(--radius) - 2px)",
    },
    formFieldInput: {
      backgroundColor: "transparent",
      border: "1px solid var(--input)",
      borderRadius: "calc(var(--radius) - 2px)",
      color: "var(--card-foreground)",
    },
    formButtonPrimary: {
      backgroundColor: "var(--primary)",
      color: "var(--primary-foreground)",
      borderRadius: "calc(var(--radius) - 2px)",
      border: "none",
      boxShadow: "none",
    },
    footerActionLink: {
      color: "var(--primary)",
    },
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
