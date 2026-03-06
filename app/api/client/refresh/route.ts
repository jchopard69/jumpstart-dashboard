import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { runTenantSync } from "@/lib/sync";
import { isDemoTenant, logDemoAccess } from "@/lib/demo";

const COOLDOWN_MINUTES = 10;

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTenantId = searchParams.get("tenantId");
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id,role")
      .eq("id", user.id)
      .single();

    // Resolve tenantId: admin can target any tenant, client users can target tenants they have access to
    let tenantId = profile?.tenant_id;
    if (requestedTenantId) {
      if (profile?.role === "agency_admin") {
        tenantId = requestedTenantId;
      } else {
        // Validate client user has access to the requested tenant
        const { data: access } = await supabase
          .from("user_tenant_access")
          .select("tenant_id")
          .eq("user_id", user.id)
          .eq("tenant_id", requestedTenantId)
          .maybeSingle();
        if (access || profile?.tenant_id === requestedTenantId) {
          tenantId = requestedTenantId;
        }
      }
    }
    if (!tenantId) {
      return NextResponse.json({ message: "Accès tenant indisponible." }, { status: 403 });
    }

    const { data: tenant } = await supabase
      .from("tenants")
      .select("is_active")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenant && tenant.is_active === false) {
      return NextResponse.json(
        { code: "tenant_inactive", message: "Ce workspace est désactivé." },
        { status: 403 }
      );
    }

    if (await isDemoTenant(tenantId, supabase)) {
      logDemoAccess("refresh_blocked", { tenantId, userId: user.id });
      return NextResponse.json(
        { message: "Synchronisation désactivée pour le workspace démo." },
        { status: 403 }
      );
    }

    // Use service client for reliable queries (user access already validated above)
    const serviceClient = createSupabaseServiceClient();

    const { data: runningSync } = await serviceClient
      .from("sync_logs")
      .select("id,started_at,status")
      .eq("tenant_id", tenantId)
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (runningSync?.id) {
      return NextResponse.json({
        code: "sync_running",
        message: "Une synchronisation est déjà en cours. Merci d'attendre la fin du traitement."
      }, { status: 409 });
    }

    const { data: accounts, error: accountsError } = await serviceClient
      .from("social_accounts")
      .select("last_sync_at")
      .eq("tenant_id", tenantId)
      .eq("auth_status", "active")
      .order("last_sync_at", { ascending: false })
      .limit(1);

    if (accountsError) {
      console.error("[client-refresh] Failed to query accounts:", accountsError.message);
    }

    if (!accounts?.length) {
      return NextResponse.json(
        {
          code: "no_active_accounts",
          message: "Aucun compte social actif n'est connecté à ce workspace."
        },
        { status: 400 }
      );
    }

    const lastSync = accounts[0]?.last_sync_at ? new Date(accounts[0].last_sync_at) : null;
    if (lastSync) {
      const diffMinutes = (Date.now() - lastSync.getTime()) / (1000 * 60);
      if (diffMinutes < COOLDOWN_MINUTES) {
        return NextResponse.json({
          code: "sync_cooldown",
          retryInMinutes: Math.ceil(COOLDOWN_MINUTES - diffMinutes),
          message: `Merci d'attendre ${Math.ceil(COOLDOWN_MINUTES - diffMinutes)} min avant de relancer une synchro.`
        }, { status: 429 });
      }
    }

    await runTenantSync(tenantId);
    return NextResponse.json({ message: "Synchronisation terminée." });
  } catch (error) {
    console.error("[client-refresh] Refresh failed", error);
    return NextResponse.json(
      {
        code: "sync_failed",
        message: "La synchronisation a échoué. Réessayez dans quelques minutes."
      },
      { status: 500 }
    );
  }
}
