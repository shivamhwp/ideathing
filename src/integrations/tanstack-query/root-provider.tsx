import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient } from "convex/react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string;
if (!CONVEX_URL) {
  console.error("missing envar CONVEX_URL");
}

const convex = new ConvexReactClient(CONVEX_URL);
export { convex };

const createContext = () => {
  const convexQueryClient = new ConvexQueryClient(convex);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60 * 1000,
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });

  if (typeof window !== "undefined") {
    convexQueryClient.connect(queryClient);
  }

  return {
    queryClient,
    convexQueryClient,
    convex,
  };
};

let browserContext: ReturnType<typeof createContext> | undefined;

export function getContext() {
  if (typeof window === "undefined") {
    return createContext();
  }
  browserContext ??= createContext();
  return browserContext;
}

export function Provider({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
