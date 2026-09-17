import { prepareReport } from "@/lib/prepare-report";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { toIsoDate } from "@/lib/date";
import { PdfDocument } from "@/lib/pdf-document";
import {
  getDemoPdfWatermarkText,
  shouldUseDemoPdfWatermark,
  isDemoTenant,
} from "@/lib/demo";
import type { Platform } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authClient = createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await authClient
    .from("profiles")
    .select("id,email,full_name,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profile missing" }, { status: 403 });
  }

  const requestedTenantId = searchParams.get("tenantId") ?? undefined;
  const tenantId = await resolveActiveTenantId(profile, requestedTenantId);
  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  const dataClient =
    profile.role === "agency_admin" && Boolean(requestedTenantId)
      ? createSupabaseServiceClient()
      : authClient;

  const { data: tenant } = await dataClient
    .from("tenants")
    .select("name,is_demo")
    .eq("id", tenantId)
    .single();

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const accountId = searchParams.get("accountId") ?? undefined;
  const platformParam = searchParams.get("platform") as Platform | "all" | null;

  try {
    const accounts = await fetchDashboardAccounts({
      profile,
      tenantId,
    });
    const platformList = Array.from(new Set(accounts.map((account) => account.platform)));

    const data = await fetchDashboardData({
      preset,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      platform: (platformParam as Platform | "all") ?? "all",
      socialAccountId: accountId,
      platforms: platformList,
      profile,
      tenantId,
    });

    const isDemo = Boolean(tenant?.is_demo) || (await isDemoTenant(tenantId));
    const watermark = isDemo && shouldUseDemoPdfWatermark() ? getDemoPdfWatermarkText() : undefined;

    const documentProps = await prepareReport({ data, accounts, tenantName: tenant?.name ?? "Client", watermark, accountId });

    const pdfBuffer = await renderToBuffer(PdfDocument(documentProps));
    const safeName = (tenant?.name ?? "client")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+$/, "");
    const dateFrom = toIsoDate(data.range.start);
    const dateTo = toIsoDate(data.range.end);

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rapport-${safeName}-${dateFrom}-${dateTo}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[pdf] generation failed", error);
    return Response.json(
      { error: "Une erreur est survenue lors de la génération du PDF." },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
