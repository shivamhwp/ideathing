import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/tanstack-react-start";
import { api } from "convex/_generated/api";

const theoModeQuery = convexQuery(api.mode.queries.getCurrentMode, {});

export const useTheoMode = () => {
  const { isLoaded, isSignedIn } = useUser();
  const shouldFetchMode = isLoaded && isSignedIn;
  const query = useQuery({
    ...theoModeQuery,
    enabled: shouldFetchMode,
  });
  const mode = isSignedIn ? (query.data?.mode ?? "default") : "default";
  const canManageTheoMode = query.data?.capabilities?.canManageTheoMode ?? false;
  const isCheckingMode = !isLoaded || (isSignedIn && !query.data && !query.error);

  return {
    ...query,
    mode,
    isTheoMode: mode === "theo",
    isCheckingMode,
    canManageTheoMode,
    capabilities: query.data?.capabilities,
  };
};
