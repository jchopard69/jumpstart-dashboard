import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { generateContentIdeas } from "@/lib/content-ideas-ai";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Platform } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function readPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function POST(request: Request) {
  try {
    if (process.env.OPENAI_CONTENT_IDEAS_ENABLED !== "true") {
      return NextResponse.json(
        {
          code: "content_ideas_disabled",
          message: "L'assistant IA éditorial est mis de côté pour la V3 du dashboard.",
        },
        { status: 404 }
      );
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ message: "Non authentifié." }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ message: "Profil introuvable." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const search = new URLSearchParams(String(body.query ?? ""));
    const tenantId = await resolveActiveTenantId(profile, search.get("tenantId"));

    if (!tenantId) {
      return NextResponse.json({ message: "Accès tenant indisponible." }, { status: 403 });
    }

    const quotaMax = readPositiveInt(process.env.OPENAI_CONTENT_IDEAS_DAILY_LIMIT, 25);
    const quota = checkRateLimit(`content-ideas:${tenantId}:${user.id}`, {
      max: quotaMax,
      windowMs: DAY_MS,
    });

    if (!quota.allowed) {
      const retryHours = Math.max(1, Math.ceil(quota.retryAfterMs / (60 * 60 * 1000)));
      return NextResponse.json(
        {
          code: "content_ideas_quota_exceeded",
          message: `Quota IA atteint pour aujourd'hui. Réessayez dans environ ${retryHours} h.`,
          quota: {
            limit: quotaMax,
            remaining: 0,
            retryAfterMs: quota.retryAfterMs,
          },
        },
        { status: 429 }
      );
    }

    const accounts = await fetchDashboardAccounts({ profile, tenantId });
    const platformList = Array.from(new Set(accounts.map((account) => account.platform)));
    const data = await fetchDashboardData({
      preset: (search.get("preset") ?? "last_30_days") as any,
      from: search.get("from") ?? undefined,
      to: search.get("to") ?? undefined,
      platform: (search.get("platform") as Platform | "all" | null) ?? "all",
      socialAccountId: search.get("accountId") ?? undefined,
      platforms: platformList,
      profile,
      tenantId,
    });

    const result = await generateContentIdeas({
      data,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      count: 6,
    });

    return NextResponse.json({
      ...result,
      context: {
        tenantId,
        query: search.toString(),
      },
      quota: {
        limit: quotaMax,
        remaining: quota.remaining,
        retryAfterMs: 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    if (message.includes("OPENAI_API_KEY")) {
      return NextResponse.json(
        {
          code: "openai_not_configured",
          message: "La génération IA n'est pas encore configurée. Ajoutez OPENAI_API_KEY côté serveur.",
        },
        { status: 503 }
      );
    }
    console.error("[content-ideas] generation failed", error);
    return NextResponse.json(
      {
        code: "content_ideas_failed",
        message: "Impossible de générer des idées pour le moment.",
      },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
