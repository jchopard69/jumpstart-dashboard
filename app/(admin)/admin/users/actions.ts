"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { assertTenantNotDemoWritable } from "@/lib/demo";
import type { UserRole } from "@/lib/types";

export async function createUserWithPassword(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "");
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "client_user") as UserRole;
  const tenantId = String(formData.get("tenant_id") ?? "") || null;

  if (!email || !password) {
    return { error: "Email et mot de passe requis" };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caracteres" };
  }

  const supabase = createSupabaseServiceClient();
  if (tenantId) {
    await assertTenantNotDemoWritable(tenantId, "create_user_for_tenant", supabase);
  }

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingProfile) {
    return { error: "Un utilisateur avec cet email existe deja" };
  }

  // Create user in auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    return { error: `Erreur creation utilisateur: ${error.message}` };
  }

  if (!data?.user) {
    return { error: "Erreur lors de la creation de l'utilisateur" };
  }

  // Create profile
  await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    tenant_id: role === "agency_admin" ? null : tenantId
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserPrimaryTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "") || null;

  const supabase = createSupabaseServiceClient();
  if (tenantId) {
    await assertTenantNotDemoWritable(tenantId, "update_user_primary_tenant", supabase);
  }

  await supabase
    .from("profiles")
    .update({ tenant_id: tenantId })
    .eq("id", userId);

  revalidatePath("/admin/users");
}

export async function addTenantAccess(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "add_user_tenant_access", supabase);

  const { error } = await supabase.from("user_tenant_access").insert({
    user_id: userId,
    tenant_id: tenantId
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  revalidatePath("/admin/users");
}

export async function removeTenantAccess(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "remove_user_tenant_access", supabase);

  await supabase
    .from("user_tenant_access")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  revalidatePath("/admin/users");
}

export async function deleteUser(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const userId = String(formData.get("user_id") ?? "");

  if (userId === profile.id) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  }

  const supabase = createSupabaseServiceClient();

  // Delete from auth (will cascade to profiles due to FK)
  const { error } = await supabase.auth.admin.deleteUser(userId);

  if (error) {
    throw new Error(`Erreur suppression: ${error.message}`);
  }

  revalidatePath("/admin/users");
}
