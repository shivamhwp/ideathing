import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "convex/_generated/api";

const theoModeQuery = convexQuery(api.mode.queries.getCurrentMode, {});

export const useTheoMode = () => {
  const query = useQuery(theoModeQuery);
  const mode = query.data?.mode ?? "default";
  const canManageTheoMode = query.data?.capabilities?.canManageTheoMode ?? false;

  return {
    ...query,
    mode,
    isTheoMode: mode === "theo",
    canManageTheoMode,
    capabilities: query.data?.capabilities,
  };
};

export { theoModeQuery };
