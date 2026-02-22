import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { UserRole } from "./types";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  tenant_id: string | null;
};

export type AccessibleTenant = {
  id: string;
  name: string;
  slug: string;
};

export async function getSessionProfile() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return profile as Profile;
}

export function requireRole(profile: Profile, allowed: UserRole[]) {
  if (!allowed.includes(profile.role)) {
    redirect("/client/dashboard");
  }
}

export function requireAdmin(profile: Profile) {
  if (profile.role !== "agency_admin") {
    redirect("/client/dashboard");
  }
}

export function requireClientAccess(profile: Profile) {
  if (!profile.tenant_id) {
    redirect("/admin");
  }
}

export function assertTenant(profile: Profile) {
  if (!profile.tenant_id) {
    throw new Error("Tenant missing for user profile");
  }
  return profile.tenant_id;
}

export async function getUserTenants(userId: string): Promise<AccessibleTenant[]> {
  const supabase = createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  const { data: additionalAccess } = await supabase
    .from("user_tenant_access")
    .select("tenant_id")
    .eq("user_id", userId);

  const tenantIds = new Set<string>();
  if (profile?.tenant_id) {
    tenantIds.add(profile.tenant_id);
  }
  if (additionalAccess) {
    for (const access of additionalAccess) {
      tenantIds.add(access.tenant_id);
    }
  }

  if (tenantIds.size === 0) {
    return [];
  }

  const { data: tenants } = await supabase
    .from("tenants")
    .select("id,name,slug")
    .in("id", Array.from(tenantIds))
    .eq("is_active", true)
    .order("name");

  return (tenants ?? []) as AccessibleTenant[];
}
