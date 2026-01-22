import { NextResponse } from "next/server";
import { syncAdsForTenant } from "@/lib/ads/sync";

function validateAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured");
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === cronSecret) {
      return true;
    }
  }

  return false;
}

export async function POST(request: Request) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const lookbackDays = Number(searchParams.get("days") ?? 30);

  if (!tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const startTime = Date.now();
  try {
    const results = await syncAdsForTenant(tenantId, lookbackDays);
    const duration = Date.now() - startTime;
    return NextResponse.json({ ok: true, duration, results });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message, duration }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
