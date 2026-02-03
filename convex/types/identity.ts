import "convex/server";

declare module "convex/server" {
  interface UserIdentity {
    readonly aud?: string;
    readonly org_id?: string;
    readonly org_name?: string;
    readonly org_role?: string;
    readonly org_slug?: string;
    readonly org_image_url?: string;
    readonly updated_at?: number;
  }
}
