/**
 * Validates if a string is a Convex storage ID.
 * Convex storage IDs are base64url-encoded strings that start with 'k' followed by alphanumeric characters.
 */
export function isConvexStorageId(value: string | null | undefined): boolean {
  if (!value) return false;
  // Convex storage IDs: start with 'k', followed by alphanumeric/underscore/hyphen, no protocol
  return /^k[a-zA-Z0-9_-]+$/.test(value) && !value.includes("://");
}
