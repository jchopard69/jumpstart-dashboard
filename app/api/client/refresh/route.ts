import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runTenantSync } from "@/lib/sync";

const COOLDOWN_MINUTES = 10;

export async function POST(request: Request) {
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

  const tenantId =
    profile?.role === "agency_admin" && requestedTenantId ? requestedTenantId : profile?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ message: "Accès tenant indisponible." }, { status: 403 });
  }

  const { data: accounts } = await supabase
    .from("social_accounts")
    .select("last_sync_at")
    .eq("tenant_id", tenantId)
    .order("last_sync_at", { ascending: false })
    .limit(1);

  const lastSync = accounts?.[0]?.last_sync_at ? new Date(accounts[0].last_sync_at) : null;
  if (lastSync) {
    const diffMinutes = (Date.now() - lastSync.getTime()) / (1000 * 60);
    if (diffMinutes < COOLDOWN_MINUTES) {
      return NextResponse.json({
        message: `Merci d'attendre ${Math.ceil(COOLDOWN_MINUTES - diffMinutes)} min avant de relancer une synchro.`
      });
    }
  }

  await runTenantSync(tenantId);
  return NextResponse.json({ message: "Synchronisation lancée." });
}
