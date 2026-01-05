import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
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

  if (profile?.role !== "agency_admin") {
    return NextResponse.json({ message: "Rôle admin requis." }, { status: 403 });
  }

  const { data: tenants } = await supabase.from("tenants").select("id").limit(2);
  if ((tenants ?? []).length < 2) {
    return NextResponse.json({ message: "Ajoutez au moins 2 tenants pour lancer le contrôle d'isolation." });
  }

  const [tenantA, tenantB] = tenants ?? [];

  const { data: crossTenantMetrics } = await supabase
    .from("social_daily_metrics")
    .select("tenant_id")
    .eq("tenant_id", tenantB.id)
    .limit(1);

  if ((crossTenantMetrics ?? []).length > 0) {
    return NextResponse.json({
      message:
        "L'accès admin voit plusieurs tenants par design. Pour valider l'isolation stricte, connectez-vous en client et vérifiez que l'accès inter-tenant est bloqué."
    });
  }

  return NextResponse.json({ message: "Aucune donnée inter-tenant visible dans cette session." });
}
