import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateLinkedInAuthUrl, generateOAuthState } from "@/lib/social-platforms/linkedin/auth";
import { setOAuthCookies } from "@/lib/social-platforms/core/oauth-cookies";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "agency_admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const service = createSupabaseServiceClient();
  const { data: tenant, error: tenantError } = await service
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  try {
    const state = generateOAuthState(tenantId);
    const authUrl = generateLinkedInAuthUrl(tenantId, state);
    console.log(`[linkedin-oauth] Initiating OAuth for tenant: ${tenant.name} (${tenantId})`);
    const response = NextResponse.redirect(authUrl);
    setOAuthCookies(response, "linkedin", state);
    return response;
  } catch (error) {
    console.error("[linkedin-oauth] Failed to generate auth URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate OAuth" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
