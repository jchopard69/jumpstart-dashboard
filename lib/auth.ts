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
