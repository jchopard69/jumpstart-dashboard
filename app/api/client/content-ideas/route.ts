import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveActiveTenantId } from "@/lib/auth";
import { fetchDashboardAccounts, fetchDashboardData } from "@/lib/queries";
import { generateContentIdeas } from "@/lib/content-ideas-ai";
import type { Platform } from "@/lib/types";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json(result);
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
