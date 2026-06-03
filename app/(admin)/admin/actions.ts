"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getSessionProfile, requireAdmin } from "@/lib/auth";
import { encryptToken } from "@/lib/crypto";
import { assertTenantNotDemoWritable } from "@/lib/demo";
import type { UserRole } from "@/lib/types";
import {
  parseStrategyActionOwner,
  parseStrategyActionPriority,
  parseStrategyActionStatus,
} from "@/lib/strategy-actions";

export async function createTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  if (!name || name.length > 255) {
    throw new Error("Nom invalide (1-255 caractères)");
  }
  if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug.length > 63) {
    throw new Error("Slug invalide (lettres minuscules, chiffres, tirets uniquement, max 63 caractères)");
  }
  const supabase = createSupabaseServiceClient();
  await supabase.from("tenants").insert({ name, slug, is_active: true });
  revalidatePath("/admin/clients");
}

export async function deactivateTenant(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenantId") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "deactivate_tenant", supabase);
  await supabase.from("tenants").update({ is_active: false }).eq("id", tenantId);
  revalidatePath("/admin/clients");
}

export async function inviteUser(
  _prevState: { error?: string; success?: string } | null,
  formData: FormData
): Promise<{ error?: string; success?: string }> {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "");
  const role = String(formData.get("role") ?? "client_user") as UserRole;
  const tenantId = String(formData.get("tenant_id") ?? "");

  if (!email) {
    return { error: "Email requis" };
  }

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "invite_user", supabase);

  // Check if user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  if (existingUser) {
    // User exists in auth, check if profile exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id,tenant_id")
      .eq("id", existingUser.id)
      .single();

    if (existingProfile) {
      if (existingProfile.tenant_id === tenantId) {
        return { error: "Cet utilisateur est deja membre de ce workspace" };
      }
      return {
        error: "Cet utilisateur existe deja dans un autre workspace. Utilisez la section 'Acces multi-tenant' pour lui donner acces a ce workspace."
      };
    }

    // User in auth but no profile - create profile
    await supabase.from("profiles").insert({
      id: existingUser.id,
      email,
      full_name: fullName,
      role,
      tenant_id: role === "agency_admin" ? null : tenantId
    });
    revalidatePath(`/admin/clients/${tenantId}`);
    return { success: `Profil cree pour ${email}` };
  }

  // New user - send invite
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?type=invite`
  });

  if (error) {
    if (error.message.includes("rate limit")) {
      return { error: "Trop de demandes. Reessayez dans quelques minutes." };
    }
    if (error.message.includes("SMTP") || error.message.includes("email")) {
      return {
        error: "Impossible d'envoyer l'email. Verifiez la configuration SMTP dans Supabase Dashboard."
      };
    }
    return { error: `Erreur d'invitation: ${error.message}` };
  }

  if (!data?.user) {
    return { error: "Erreur lors de la creation de l'utilisateur" };
  }

  await supabase.from("profiles").insert({
    id: data.user.id,
    email,
    full_name: fullName,
    role,
    tenant_id: role === "agency_admin" ? null : tenantId
  });

  revalidatePath(`/admin/clients/${tenantId}`);
  return { success: `Invitation envoyee a ${email}` };
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
  const secret = process.env.ENCRYPTION_SECRET;
  const demoMode = process.env.DEMO_MODE === "true";

  if ((token || refreshToken) && !secret) {
    throw new Error("ENCRYPTION_SECRET is not configured");
  }

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "create_social_account", supabase);
  await supabase.from("social_accounts").insert({
    tenant_id: tenantId,
    platform,
    account_name: accountName,
    external_account_id: externalId,
    auth_status: token || demoMode ? "active" : "pending",
    token_encrypted: token ? encryptToken(token, secret!) : null,
    refresh_token_encrypted: refreshToken ? encryptToken(refreshToken, secret!) : null
  });

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function deleteSocialAccount(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const accountId = String(formData.get("account_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "delete_social_account", supabase);
  await supabase.from("social_accounts").delete().eq("id", accountId);
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function selectLinkedInAccounts(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const selectedIds = formData.getAll("account_ids")
    .map((id) => String(id))
    .filter((id) => uuidRegex.test(id));
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "select_linkedin_accounts", supabase);

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
    deleteQuery = deleteQuery.not("id", "in", `(${selectedIds.join(",")})`);
  }

  await deleteQuery;

  revalidatePath(`/admin/clients/${tenantId}`);

  const { redirect } = await import("next/navigation");
  redirect(`/admin/clients/${tenantId}?linkedin_success=true&linkedin_accounts=${selectedIds.length}`);
}

export async function updateCollaboration(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const shootDays = Number(formData.get("shoot_days_remaining") ?? 0);
  const notes = String(formData.get("notes") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "update_collaboration", supabase);
  await supabase.from("collaboration").upsert({
    tenant_id: tenantId,
    shoot_days_remaining: shootDays,
    notes,
    updated_at: new Date().toISOString()
  });
  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function updateClientStrategyProfile(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "update_client_strategy_profile", supabase);
  await supabase.from("client_strategy_profiles").upsert({
    tenant_id: tenantId,
    positioning: String(formData.get("positioning") ?? "").trim() || null,
    target_audience: String(formData.get("target_audience") ?? "").trim() || null,
    offer_focus: String(formData.get("offer_focus") ?? "").trim() || null,
    brand_voice: String(formData.get("brand_voice") ?? "").trim() || null,
    editorial_pillars: String(formData.get("editorial_pillars") ?? "").trim() || null,
    current_quarter_objectives: String(formData.get("current_quarter_objectives") ?? "").trim() || null,
    monthly_focus: String(formData.get("monthly_focus") ?? "").trim() || null,
    jumpstart_note: String(formData.get("jumpstart_note") ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  });
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath(`/client/strategy`);
}

export async function upsertMonthlyStrategyBrief(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const month = String(formData.get("period_month") ?? "").trim();
  const periodMonth = month ? `${month}-01` : new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "upsert_monthly_strategy_brief", supabase);
  await supabase.from("monthly_strategy_briefs").upsert({
    tenant_id: tenantId,
    period_month: periodMonth,
    title: String(formData.get("title") ?? "Brief mensuel JumpStart").trim() || "Brief mensuel JumpStart",
    executive_summary: String(formData.get("executive_summary") ?? "").trim() || null,
    wins: String(formData.get("wins") ?? "").trim() || null,
    learnings: String(formData.get("learnings") ?? "").trim() || null,
    next_focus: String(formData.get("next_focus") ?? "").trim() || null,
    client_requests: String(formData.get("client_requests") ?? "").trim() || null,
    jumpstart_actions: String(formData.get("jumpstart_actions") ?? "").trim() || null,
    is_published: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,period_month" });
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath(`/client/strategy`);
}

export async function addStrategyActionItem(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const priority = parseStrategyActionPriority(formData.get("priority") ?? "medium");
  const owner = parseStrategyActionOwner(formData.get("owner") ?? "jumpstart");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "add_strategy_action_item", supabase);
  await supabase.from("strategy_action_items").insert({
    tenant_id: tenantId,
    title,
    rationale: String(formData.get("rationale") ?? "").trim() || null,
    expected_impact: String(formData.get("expected_impact") ?? "").trim() || null,
    owner,
    priority,
    status: "recommended",
    due_date: String(formData.get("due_date") ?? "").trim() || null,
  });
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath(`/client/strategy`);
}

export async function updateStrategyActionStatus(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const actionId = String(formData.get("action_id") ?? "");
  const status = parseStrategyActionStatus(formData.get("status"));

  if (!tenantId || !actionId) {
    throw new Error("Action stratégique introuvable.");
  }

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "update_strategy_action_status", supabase);

  await supabase
    .from("strategy_action_items")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("id", actionId);

  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath(`/client/strategy`);
}

export async function addUpcomingShoot(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const shootDate = String(formData.get("shoot_date") ?? "");
  const location = String(formData.get("location") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "add_upcoming_shoot", supabase);
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
  if (!filePath.startsWith(`${tenantId}/`)) {
    throw new Error("Chemin de fichier invalide.");
  }
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "upload_document_metadata", supabase);
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
  await assertTenantNotDemoWritable(tenantId, "trigger_tenant_sync");
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

export async function resetLinkedInData(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "reset_linkedin_data", supabase);

  await supabase.from("social_daily_metrics").delete().eq("tenant_id", tenantId).eq("platform", "linkedin");
  await supabase.from("social_posts").delete().eq("tenant_id", tenantId).eq("platform", "linkedin");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (baseUrl) {
    await fetch(`${baseUrl}/api/cron/sync?tenantId=${tenantId}&platform=linkedin`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CRON_SECRET ?? ""}`
      }
    });
  }

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function addTenantAccess(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "add_tenant_access", supabase);

  const { error } = await supabase.from("user_tenant_access").insert({
    user_id: userId,
    tenant_id: tenantId
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function removeTenantAccess(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const userId = String(formData.get("user_id") ?? "");
  const tenantId = String(formData.get("tenant_id") ?? "");
  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "remove_tenant_access", supabase);

  await supabase
    .from("user_tenant_access")
    .delete()
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);

  revalidatePath(`/admin/clients/${tenantId}`);
}

export async function updateTenantGoals(formData: FormData) {
  const profile = await getSessionProfile();
  requireAdmin(profile);
  const tenantId = String(formData.get("tenant_id") ?? "");
  const followersTarget = formData.get("followers_target") ? Number(formData.get("followers_target")) : null;
  const engagementRateTarget = formData.get("engagement_rate_target") ? Number(formData.get("engagement_rate_target")) : null;
  const postsPerWeekTarget = formData.get("posts_per_week_target") ? Number(formData.get("posts_per_week_target")) : null;
  const reachTarget = formData.get("reach_target") ? Number(formData.get("reach_target")) : null;
  const viewsTarget = formData.get("views_target") ? Number(formData.get("views_target")) : null;

  const supabase = createSupabaseServiceClient();
  await assertTenantNotDemoWritable(tenantId, "update_tenant_goals", supabase);
  await supabase.from("tenant_goals").upsert({
    tenant_id: tenantId,
    followers_target: followersTarget,
    engagement_rate_target: engagementRateTarget,
    posts_per_week_target: postsPerWeekTarget,
    reach_target: reachTarget,
    views_target: viewsTarget,
    updated_at: new Date().toISOString(),
  });

  revalidatePath(`/admin/clients/${tenantId}`);
}
