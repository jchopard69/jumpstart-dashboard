import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { Browser } from "puppeteer-core";
import fs from "fs";
import path from "path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildDashboardPdfHtml, buildSparkline } from "@/lib/pdf";
import { resolveDateRange } from "@/lib/date";
import type { Platform } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profile missing" }, { status: 403 });
  }

  const tenantId = profile.role === "agency_admin" && searchParams.get("tenantId")
    ? searchParams.get("tenantId")
    : profile.tenant_id;

  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  const { data: tenant } = await supabase.from("tenants").select("name").eq("id", tenantId).single();

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const range = resolveDateRange(preset, searchParams.get("from") ?? undefined, searchParams.get("to") ?? undefined);
  const platformParam = searchParams.get("platform");
  const platform = platformParam && platformParam !== "all" ? (platformParam as Platform) : null;

  let metricsQuery = supabase
    .from("social_daily_metrics")
    .select("date,followers,impressions,reach,engagements,views,watch_time,posts_count")
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (platform) {
    metricsQuery = metricsQuery.eq("platform", platform);
  }

  const { data: metrics } = await metricsQuery;
  const totals = metrics?.reduce(
    (acc, row) => {
      acc.followers = row.followers ?? acc.followers;
      acc.impressions += row.impressions ?? 0;
      acc.reach += row.reach ?? 0;
      acc.engagements += row.engagements ?? 0;
      acc.views += row.views ?? 0;
      acc.watch_time += row.watch_time ?? 0;
      acc.posts_count += row.posts_count ?? 0;
      return acc;
    },
    { followers: 0, impressions: 0, reach: 0, engagements: 0, views: 0, watch_time: 0, posts_count: 0 }
  );

  const { data: posts } = await supabase
    .from("social_posts")
    .select("caption,posted_at,metrics")
    .eq("tenant_id", tenantId)
    .gte("posted_at", range.start.toISOString())
    .lte("posted_at", range.end.toISOString())
    .order("posted_at", { ascending: false })
    .limit(8);

  const { data: collaboration } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining")
    .eq("tenant_id", tenantId)
    .single();

  const { data: shoots } = await supabase
    .from("upcoming_shoots")
    .select("shoot_date,location")
    .eq("tenant_id", tenantId)
    .order("shoot_date", { ascending: true });

  const { data: documents } = await supabase
    .from("documents")
    .select("file_name,tag")
    .eq("tenant_id", tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const chartSeries = {
    followers: metrics?.map((m) => m.followers ?? 0) ?? [],
    views: metrics?.map((m) => m.views ?? 0) ?? [],
    engagements: metrics?.map((m) => m.engagements ?? 0) ?? [],
    reach: metrics?.map((m) => m.reach ?? 0) ?? []
  };

  const formatRate = (value: number) =>
    new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);

  const html = buildDashboardPdfHtml({
    profile,
    tenantName: tenant?.name ?? "Client",
    rangeLabel: `${range.start.toLocaleDateString("fr-FR")} - ${range.end.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis: [
      { label: "Abonnés", value: `${totals?.followers ?? 0}` },
      { label: "Vues", value: `${totals?.views ?? 0}` },
      { label: "Portée", value: `${totals?.reach ?? 0}` },
      { label: "Engagements", value: `${totals?.engagements ?? 0}` },
      { label: "Publications", value: `${totals?.posts_count ?? 0}` },
      {
        label: "Taux d'engagement",
        value: totals?.views
          ? `${formatRate((totals.engagements / totals.views) * 100)}%`
          : "0%"
      }
    ],
    charts: [
      { title: "Abonnés", svg: buildSparkline(chartSeries.followers) },
      { title: "Vues", svg: buildSparkline(chartSeries.views) },
      { title: "Engagements", svg: buildSparkline(chartSeries.engagements) },
      { title: "Portée", svg: buildSparkline(chartSeries.reach) }
    ],
    posts: (posts ?? [])
      .sort((a, b) => {
        const aEng = a.metrics?.engagements ?? a.metrics?.likes ?? 0;
        const bEng = b.metrics?.engagements ?? b.metrics?.likes ?? 0;
        const aViews = a.metrics?.views ?? 0;
        const bViews = b.metrics?.views ?? 0;
        return bEng - aEng || bViews - aViews;
      })
      .map((post) => ({
        caption: post.caption ?? "Sans titre",
        date: post.posted_at ? new Date(post.posted_at).toLocaleDateString("fr-FR") : "-",
        views: post.metrics?.views ?? 0,
        engagements: post.metrics?.engagements ?? post.metrics?.likes ?? 0
      })),
    collaboration: {
      shootDays: collaboration?.shoot_days_remaining ?? 0,
      shoots: (shoots ?? []).map((shoot) => ({
        date: new Date(shoot.shoot_date).toLocaleDateString("fr-FR"),
        location: shoot.location ?? ""
      }))
    },
    documents: (documents ?? []).map((doc) => ({
      name: doc.file_name,
      tag: doc.tag
    }))
  });

  let browser: Browser | null = null;
  try {
    const taskRoot = process.env.LAMBDA_TASK_ROOT ?? process.cwd();
    const baseCandidates = [
      path.join(taskRoot, "node_modules", "@sparticuz", "chromium"),
      path.join(taskRoot, ".next", "standalone", "node_modules", "@sparticuz", "chromium"),
      path.join(taskRoot, ".next", "server", "node_modules", "@sparticuz", "chromium"),
      path.join("/var/task", "node_modules", "@sparticuz", "chromium"),
      path.join("/var/task", ".next", "standalone", "node_modules", "@sparticuz", "chromium"),
      path.join("/var/task", ".next", "server", "node_modules", "@sparticuz", "chromium")
    ];

    const chromiumBase = baseCandidates.find((candidate) => fs.existsSync(candidate));
    let executablePath: string | undefined;

    if (chromiumBase) {
      try {
        const resolved = await chromium.executablePath(path.join(chromiumBase, "bin"));
        if (typeof resolved === "string") {
          executablePath = resolved;
        }
      } catch (error) {
        console.warn("[pdf] chromium path resolution failed", error);
      }
    }

    if (!executablePath) {
      try {
        const resolved = await chromium.executablePath();
        if (typeof resolved === "string") {
          executablePath = resolved;
        }
      } catch (error) {
        console.warn("[pdf] chromium default path resolution failed", error);
      }
    }

    if (!executablePath) {
      executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_PATH || undefined;
    }

    if (!executablePath) {
      throw new Error("Chromium executable path not resolved.");
    }

    const libCandidates = [
      chromiumBase ? path.join(chromiumBase, "lib") : null,
      path.join(path.dirname(executablePath), "lib"),
      path.join(path.dirname(executablePath), "..", "lib")
    ].filter(Boolean) as string[];

    const libPath = libCandidates.find((candidate) => fs.existsSync(candidate));
    if (libPath) {
      process.env.LD_LIBRARY_PATH = [libPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(":");
    }

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.emulateMediaType("screen");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=jumpstart-${tenant?.name ?? "client"}.pdf`
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    console.error("[pdf] generation failed", error);
    return Response.json({ error: message }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
