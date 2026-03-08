"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { assertTenantNotDemoWritable } from "@/lib/demo";
import type { UserRole } from "@/lib/types";

// State-returning variants for better UX (useActionState)
export async function inviteTenantMemberState(
  _prev: { ok?: boolean; message?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await inviteTenantMember(formData);
    return { ok: true, message: "Invitation envoyée / accès ajouté." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return { ok: false, message: msg };
  }
}

export async function inviteTenantMember(formData: FormData): Promise<void> {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "client_user") as UserRole;

  if (!tenantId) throw new Error("Tenant manquant");
  if (!email) throw new Error("Email requis");

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "invite_tenant_member", supabase);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const redirectTo = siteUrl ? `${siteUrl}/auth/callback?type=invite` : undefined;

  // Prefer a targeted lookup by email in profiles (fast). Avoid listing all auth users.
  const { data: existingProfileByEmail } = await supabase
    .from("profiles")
    .select("id,email,tenant_id")
    .eq("email", email)
    .maybeSingle();

  const findUserIdByEmailViaAdminList = async (): Promise<string | null> => {
    // Fallback only: handle cases where a user exists in auth but profile wasn't created.
    // listUsers is paginated; iterate a few pages.
    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        throw new Error(`Impossible de lister les utilisateurs: ${error.message}`);
      }
      const u = data?.users?.find((user) => user.email?.toLowerCase() === email);
      if (u?.id) return u.id;
      if ((data?.users?.length ?? 0) < perPage) break;
    }
    return null;
  };

  let userId: string | null = existingProfileByEmail?.id ?? null;

  if (!userId) {
    // Try invite (creates user if needed). If the user already exists, Supabase may error —
    // in that case fallback to admin list lookup.
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
    });

    if (error) {
      // Best-effort fallback for "already registered" cases.
      const fallbackId = await findUserIdByEmailViaAdminList();
      if (!fallbackId) {
        throw new Error(`Erreur d'invitation: ${error.message}`);
      }
      userId = fallbackId;
    } else {
      userId = data.user?.id ?? null;
      if (!userId) {
        throw new Error("Erreur lors de la création de l'utilisateur");
      }
    }
  }

  // Ensure profile exists (best-effort). For SaaS, we keep tenant_id as primary only if empty.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id,tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (!existingProfile) {
    await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName || null,
      role,
      tenant_id: role === "agency_admin" ? null : tenantId,
    });
  } else if (!existingProfile.tenant_id && role !== "agency_admin") {
    // If the user has no primary tenant yet, set it.
    await supabase.from("profiles").update({ tenant_id: tenantId, role }).eq("id", userId);
  }

  // Add tenant membership (idempotent)
  const { error: accessError } = await supabase.from("user_tenant_access").insert({
    user_id: userId,
    tenant_id: tenantId,
    role,
  });

  if (accessError && accessError.code !== "23505") {
    throw new Error(accessError.message);
  }

  revalidatePath(`/admin/clients/${tenantId}/members`);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function updateTenantMemberRoleState(
  _prev: { ok?: boolean; message?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await updateTenantMemberRole(formData);
    return { ok: true, message: "OK" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return { ok: false, message: msg };
  }
}

export async function updateTenantMemberRole(formData: FormData): Promise<void> {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const role = String(formData.get("role") ?? "client_user") as UserRole;

  if (!tenantId) throw new Error("Tenant manquant");
  if (!userId) throw new Error("User manquant");

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "update_tenant_member_role", supabase);

  // Update membership role. (Owner role is managed via profiles.tenant_id; this only affects additional access rows.)
  const { error } = await supabase
    .from("user_tenant_access")
    .update({ role })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clients/${tenantId}/members`);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function removeTenantMemberState(
  _prev: { ok?: boolean; message?: string } | null,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  try {
    await removeTenantMember(formData);
    return { ok: true, message: "OK" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    return { ok: false, message: msg };
  }
}

export async function removeTenantMember(formData: FormData): Promise<void> {
  const profile = await getSessionProfile();
  requireAdmin(profile);

  const tenantId = String(formData.get("tenant_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();

  if (!tenantId) throw new Error("Tenant manquant");
  if (!userId) throw new Error("User manquant");

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "remove_tenant_member", supabase);

  const { error } = await supabase
    .from("user_tenant_access")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clients/${tenantId}/members`);
  revalidatePath(`/admin/clients/${tenantId}`);
}
