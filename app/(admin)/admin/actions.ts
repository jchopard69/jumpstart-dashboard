"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";
import type { UserRole } from "@/lib/types";

export async function createTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const name = String(formData.get("name") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = createSupabaseServiceClient();
  await supabase.from("tenants").insert({ name, slug, is_active: true });
  revalidatePath("/admin/clients");
}

export async function deactivateTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenantId") ?? "");
  const supabase = createSupabaseServiceClient();
  await supabase.from("tenants").update({ is_active: false }).eq("id", tenantId);
  revalidatePath("/admin/clients");
}

export async function inviteUser(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const email = String(formData.get("email") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const role = String(formData.get("role") ?? "client_user") as UserRole;
  const tenantId = String(formData.get("tenant_id") ?? "");

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/login`
  });

  if (error || !data?.user) {
    throw new Error(error?.message ?? "Unable to invite user");
  }

  await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    tenant_id: role === "agency_admin" ? null : tenantId
  });

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function createSocialAccount(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const platform = String(formData.get("platform") ?? "instagram");
  const accountName = String(formData.get("account_name") ?? "");
  const externalId = String(formData.get("external_account_id") ?? "");
  const token = String(formData.get("token") ?? "");
  const refreshToken = String(formData.get("refresh_token") ?? "");
  const secret = process.env.ENCRYPTION_SECRET ?? "";
  const demoMode = process.env.DEMO_MODE === "true";

  const supabase = createSupabaseServiceClient();
  await supabase.from("social_accounts").insert({
    tenant_id: tenantId,
    platform,
    account_name: accountName,
    external_account_id: externalId,
    auth_status: token || demoMode ? "active" : "pending",
    token_encrypted: token ? encryptToken(token, secret) : null,
    refresh_token_encrypted: refreshToken ? encryptToken(refreshToken, secret) : null
  });

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function deleteSocialAccount(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const accountId = String(formData.get("account_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await supabase.from("social_accounts").delete().eq("id", accountId);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function selectLinkedInAccounts(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const selectedIds = formData.getAll("account_ids").map((id) => String(id));
  const supabase = createSupabaseServiceClient();

  if (selectedIds.length) {
    await supabase
      .from("social_accounts")
      .update({ auth_status: "active", last_sync_at: null })
      .eq("tenant_id", tenantId)
      .eq("platform", "linkedin")
      .in("id", selectedIds);
  }

  let deleteQuery = supabase
    .from("social_accounts")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("platform", "linkedin")
    .eq("auth_status", "pending");

  if (selectedIds.length) {
    deleteQuery = deleteQuery.not("id", "in", `(${selectedIds.map((id) => `"${id}"`).join(",")})`);
  }

  await deleteQuery;

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function updateCollaboration(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const shootDays = Number(formData.get("shoot_days_remaining") ?? 0);
  const notes = String(formData.get("notes") ?? "");
  const supabase = createSupabaseServiceClient();
  await supabase.from("collaboration").upsert({
    tenant_id: tenantId,
    shoot_days_remaining: shootDays,
    notes,
    updated_at: new Date().toISOString()
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function addUpcomingShoot(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const shootDate = String(formData.get("shoot_date") ?? "");
  const location = String(formData.get("location") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const supabase = createSupabaseServiceClient();
  await supabase.from("upcoming_shoots").insert({
    tenant_id: tenantId,
    shoot_date: shootDate,
    location,
    notes
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function uploadDocumentMetadata(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const filePath = String(formData.get("file_path") ?? "");
  const fileName = String(formData.get("file_name") ?? "");
  const tag = String(formData.get("tag") ?? "other");
  const pinned = String(formData.get("pinned") ?? "false") === "true";
  const supabase = createSupabaseServiceClient();
  await supabase.from("documents").insert({
    tenant_id: tenantId,
    file_path: filePath,
    file_name: fileName,
    tag,
    pinned
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function triggerTenantSync(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is missing");
  }
  await fetch(`${baseUrl}/api/cron/sync?tenantId=${tenantId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`
    }
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}
