import { NextResponse } from "next/server";
import { runGlobalSync, runTenantSync } from "@/lib/sync";
import type { Platform } from "@/lib/types";
import { isDemoTenant, logDemoAccess } from "@/lib/demo";

/**
 * Validate authorization using Bearer token
 * Supports both header-based auth (preferred) and query param (legacy)
 */
function validateAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron] CRON_SECRET not configured");
    return false;
  }

  // Check Authorization header first (preferred method)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === cronSecret) {
      return true;
    }
  }

  // Query param auth removed for security (secrets in URLs get logged)

  return false;
}

export async function POST(request: Request) {
  // Validate authentication
  if (!validateAuth(request)) {
    console.warn("[cron] Unauthorized sync attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenantId");
  const platformParam = searchParams.get("platform");
  const platform = platformParam && platformParam !== "all" ? (platformParam as Platform) : null;

  const startTime = Date.now();

  try {
    console.log("[cron] Starting sync", { tenantId, platform });

    if (tenantId) {
      if (await isDemoTenant(tenantId)) {
        logDemoAccess("cron_sync_skipped", { tenantId, platform: platform ?? "all" });
        return NextResponse.json({
          ok: true,
          duration: Date.now() - startTime,
          scope: `tenant:${tenantId}`,
          platform: platform || "all",
          skipped: "demo_tenant",
        });
      }
      await runTenantSync(tenantId, platform ?? undefined);
    } else {
      await runGlobalSync();
    }

    const duration = Date.now() - startTime;
    console.log(`[cron] Sync completed in ${duration}ms`);

    return NextResponse.json({
      ok: true,
      duration,
      scope: tenantId ? `tenant:${tenantId}` : "global",
      platform: platform || "all",
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error("[cron] Sync failed:", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      duration,
    });

    return NextResponse.json(
      {
        ok: false,
        error: "Sync failed",
        duration,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // Vercel Cron uses GET requests. We still enforce the same auth as POST.
  return POST(request);
}

export const dynamic = "force-dynamic";
