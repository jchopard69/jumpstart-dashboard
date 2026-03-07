import { NextResponse } from "next/server";
import { processScheduledReports } from "@/lib/report-scheduler";

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
    console.warn("[cron] Unauthorized send-reports attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log("[cron] Starting scheduled report sending");
    const result = await processScheduledReports();
    const duration = Date.now() - startTime;

    console.log(`[cron] Reports done in ${duration}ms: ${result.sent} sent, ${result.errors} errors`);

    return NextResponse.json({
      ok: true,
      duration,
      ...result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[cron] Report sending failed:", error instanceof Error ? error.message : error);

    return NextResponse.json(
      { ok: false, error: "Report sending failed", duration },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}

export const dynamic = "force-dynamic";
