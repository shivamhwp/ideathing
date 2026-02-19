import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { configure } from "onedollarstats";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "../components/ui/sonner";
import AppClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import { Provider as QueryProvider } from "../integrations/tanstack-query/root-provider";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

let hasConfiguredOneDollarStats = false;

function configureOneDollarStats() {
  if (hasConfiguredOneDollarStats || typeof window === "undefined") {
    return;
  }

  const hostname = import.meta.env.VITE_ONEDOLLARSTATS_HOSTNAME?.trim();
  if (import.meta.env.DEV && hostname) {
    configure({
      hostname,
      devmode: true,
    });
  } else {
    configure();
  }

  hasConfiguredOneDollarStats = true;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "ideathing",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Text:ital@0;1&display=swap",
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    </div>
  ),
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext();
  configureOneDollarStats();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="h-screen w-screen fixed">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppClerkProvider>
            <ConvexProvider>
              <QueryProvider queryClient={queryClient}>
                {children}
                <Toaster />
              </QueryProvider>
            </ConvexProvider>
          </AppClerkProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
