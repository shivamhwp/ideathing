import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "../components/ui/sonner";
import AppClerkProvider from "../integrations/clerk/provider";
import ConvexProvider from "../integrations/convex/provider";
import { Provider as QueryProvider } from "../integrations/tanstack-query/root-provider";
import { getClerkAuth } from "../lib/server/auth";
import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: async ({ context }) => {
    const authState = await getClerkAuth();
    context.convexQueryClient.serverHttpClient?.setAuth(authState.convexToken ?? "");
    return authState;
  },
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
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { queryClient } = Route.useRouteContext();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
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
