import { NextResponse } from "next/server";
import { refreshAllExpiringTokens } from "@/lib/social-platforms/core/token-manager";

/**
 * Cron endpoint to refresh expiring OAuth tokens
 * Should be called daily to prevent token expiration
 */
export async function POST(request: Request) {
  // Validate authentication
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  let authorized = false;

  // Check Bearer token
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === cronSecret) {
      authorized = true;
    }
  }

  // Optional legacy fallback (disabled by default)
  if (!authorized && process.env.CRON_ALLOW_QUERY_SECRET === "true") {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("secret") === cronSecret) {
      authorized = true;
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log("[cron] Starting token refresh job");

    const result = await refreshAllExpiringTokens();

    const duration = Date.now() - startTime;
    console.log(`[cron] Token refresh completed in ${duration}ms`, {
      refreshed: result.refreshed,
      failed: result.failed,
    });

    return NextResponse.json({
      ok: true,
      duration,
      ...result,
    });
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[cron] Token refresh failed:", errorMessage);

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
