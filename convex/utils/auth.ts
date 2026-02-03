import type { UserIdentity } from "convex/server";

export const getIdentityOrgId = (identity: UserIdentity) => {
  return identity.org_id ;
};

export const getIdentityOrgRole = (identity: UserIdentity)=> {
  return identity.org_role ;
};

export function assertOrgAccess(identity: UserIdentity, organizationId?: string) {
  if (!organizationId) return null;
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const orgId = getIdentityOrgId(identity);
  if (!orgId || orgId !== organizationId) {
    throw new Error("Unauthorized");
  }
  return orgId;
}

export const assertOrgAdmin = (
  identity: UserIdentity,
  message = "Only organization admins can perform this action",
) => {
  if (!identity) {
    throw new Error("Not authenticated");
  }
  const role = getIdentityOrgRole(identity);
  if (role !== "org:admin" && role !== "admin") {
    throw new Error(message);
  }
};
