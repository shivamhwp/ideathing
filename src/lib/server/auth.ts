import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

export const getClerkAuth = createServerFn({ method: "GET" }).handler(async () => {
  const clerkAuth = await auth();
  const convexToken = await clerkAuth.getToken({ template: "convex" });

  return {
    isSignedIn: Boolean(clerkAuth.userId),
    orgId: clerkAuth.orgId ?? null,
    convexToken,
  };
});
