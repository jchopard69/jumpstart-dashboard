import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "./supabase/server";
import type { UserRole } from "./types";
import { enforceDemoTenantIsolation } from "./demo";

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
  is_demo?: boolean;
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
    // Sign out to prevent infinite redirect loop:
    // middleware sees authenticated user → allows /client → getSessionProfile finds no profile → redirect /login
    // → middleware sees authenticated user on /login → redirect /client/dashboard → loop
    await supabase.auth.signOut();
    redirect("/login?error=no_profile");
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

export async function requireClientAccess(profile: Profile) {
  if (profile.tenant_id) return;

  // Check multi-tenant access before giving up
  const tenants = await getUserTenants(profile.id);
  if (tenants.length > 0) return;

  // No tenant access at all — if admin, send to admin; otherwise sign out
  if (profile.role === "agency_admin") {
    redirect("/admin");
  }

  // Client user with no tenant: broken state — sign out to prevent redirect loop
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login?error=no_profile");
}

export function assertTenant(profile: Profile): string {
  if (profile.tenant_id) return profile.tenant_id;

  // This should not normally happen — requireClientAccess should have caught it.
  // Throwing here triggers the error.tsx boundary with a user-friendly message.
  throw new Error(
    "Aucun workspace associe a votre compte. Contactez votre administrateur."
  );
}

export async function getUserTenants(userId: string): Promise<AccessibleTenant[]> {
  const supabase = createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id,role")
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
    .select("id,name,slug,is_demo")
    .in("id", Array.from(tenantIds))
    .eq("is_active", true)
    .order("name");

  return enforceDemoTenantIsolation(
    (tenants ?? []) as AccessibleTenant[],
    profile?.tenant_id ?? null,
    profile?.role ?? null
  );
}
