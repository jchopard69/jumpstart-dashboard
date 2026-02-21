import { NextResponse } from "next/server";
import { runGlobalSync, runTenantSync } from "@/lib/sync";
import type { Platform } from "@/lib/types";

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

  // Optional legacy fallback (disabled by default)
  if (process.env.CRON_ALLOW_QUERY_SECRET === "true") {
    const { searchParams } = new URL(request.url);
    const secretParam = searchParams.get("secret");
    if (secretParam === cronSecret) {
      console.warn("[cron] Using query param auth is deprecated. Please use Authorization: Bearer header.");
      return true;
    }
  }

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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[cron] Sync failed:", { error: errorMessage, duration });

    return NextResponse.json(
      {
        ok: false,
        error: errorMessage,
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
