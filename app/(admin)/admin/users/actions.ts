"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

export async function createUserWithPassword(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "");
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "client_user") as UserRole;
  const tenantId = String(formData.get("tenant_id") ?? "") || null;

  if (!email || !password) {
    throw new Error("Email et mot de passe requis");
  }

  if (password.length < 10) {
    throw new Error("Le mot de passe doit contenir au moins 10 caractères");
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("Le mot de passe doit contenir majuscules, minuscules et chiffres");
  }

  const supabase = createSupabaseServiceClient();

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingProfile) {
    throw new Error("Un utilisateur avec cet email existe déjà");
  }

  // Create user in auth
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    throw new Error(`Erreur création utilisateur: ${error.message}`);
  }

  if (!data?.user) {
    throw new Error("Erreur lors de la création de l'utilisateur");
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
}

export async function updateUserPrimaryTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "") || null;

  const supabase = createSupabaseServiceClient();

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
