import type { UserIdentity } from "convex/server";

type IdentityLike = UserIdentity | null;

export const getIdentityOrgId = (identity: IdentityLike): string | null => {
  return identity?.org_id ?? null;
};

export const getIdentityOrgRole = (identity: IdentityLike): string | null => {
  return identity?.org_role ?? null;
};

export const getAuthorizedOrgId = (
  identity: IdentityLike,
  organizationId?: string,
): string | null => {
  if (!organizationId || !identity) return null;
  const orgId = getIdentityOrgId(identity);
  if (!orgId || orgId !== organizationId) {
    return null;
  }
  return orgId;
};

export function assertOrgAccess(identity: IdentityLike, organizationId: string): string;
export function assertOrgAccess(identity: IdentityLike, organizationId?: string): string | null;
export function assertOrgAccess(identity: IdentityLike, organizationId?: string) {
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
  identity: IdentityLike,
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
