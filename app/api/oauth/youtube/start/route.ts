import { NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { generateYouTubeAuthUrl } from "@/lib/social-platforms/youtube/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");

  if (!tenantId) {
    return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  }

  // Verify user is authenticated and is admin
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

  // Verify tenant exists
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
    const authUrl = generateYouTubeAuthUrl(tenantId);
    console.log(`[youtube-oauth] Initiating OAuth for tenant: ${tenant.name} (${tenantId})`);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[youtube-oauth] Failed to generate auth URL:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate OAuth" },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
