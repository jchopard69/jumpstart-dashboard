import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { PdfDocument, type PdfDocumentProps } from "@/lib/pdf-document";
import { resolveDateRange, buildPreviousRange } from "@/lib/date";
import { coerceMetric, getPostEngagements, getPostImpressions, getPostVisibility } from "@/lib/metrics";
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

  const isAdmin = profile.role === "agency_admin" && searchParams.get("tenantId");
  const tenantId = isAdmin
    ? searchParams.get("tenantId")
    : profile.tenant_id;

  // Use service client for admins viewing client data (bypasses RLS)
  const supabase = isAdmin ? createSupabaseServiceClient() : authClient;

  if (!tenantId) {
    return Response.json({ error: "Tenant missing" }, { status: 403 });
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const preset = (searchParams.get("preset") ?? "last_30_days") as any;
  const range = resolveDateRange(
    preset,
    searchParams.get("from") ?? undefined,
    searchParams.get("to") ?? undefined
  );
  const prevRange = buildPreviousRange(range);

  const platformParam = searchParams.get("platform");
  const platform =
    platformParam && platformParam !== "all" ? (platformParam as Platform) : null;

  // Fetch current period metrics
  let metricsQuery = supabase
    .from("social_daily_metrics")
    .select(
      "date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform"
    )
    .eq("tenant_id", tenantId)
    .gte("date", range.start.toISOString().slice(0, 10))
    .lte("date", range.end.toISOString().slice(0, 10));

  // Fetch previous period metrics
  let prevMetricsQuery = supabase
    .from("social_daily_metrics")
    .select(
      "date,followers,impressions,reach,engagements,views,watch_time,posts_count,social_account_id,platform"
    )
    .eq("tenant_id", tenantId)
    .gte("date", prevRange.start.toISOString().slice(0, 10))
    .lte("date", prevRange.end.toISOString().slice(0, 10));

  if (platform) {
    metricsQuery = metricsQuery.eq("platform", platform);
    prevMetricsQuery = prevMetricsQuery.eq("platform", platform);
  }

  const [{ data: metrics }, { data: prevMetrics }] = await Promise.all([
    metricsQuery.order("date", { ascending: true }),
    prevMetricsQuery.order("date", { ascending: true }),
  ]);

  // Calculate followers (latest value per account)
  const sumLatestFollowers = (
    rows?: Array<{
      social_account_id?: string | null;
      date?: string | null;
      followers?: number | string | null;
    }>
  ) => {
    if (!rows?.length) return 0;
    const latestByAccount = new Map<string, { date: string; followers: number }>();
    for (const row of rows) {
      if (!row.social_account_id || row.followers == null || !row.date) continue;
      const existing = latestByAccount.get(row.social_account_id);
      if (!existing || row.date > existing.date) {
        latestByAccount.set(row.social_account_id, {
          date: row.date,
          followers: coerceMetric(row.followers),
        });
      }
    }
    let total = 0;
    for (const entry of latestByAccount.values()) {
      total += entry.followers;
    }
    return total;
  };

  const followersCurrent = sumLatestFollowers(metrics ?? undefined);
  const followersPrev = sumLatestFollowers(prevMetrics ?? undefined);

  // Calculate totals
  const totals = (metrics ?? []).reduce(
    (acc, row) => {
      acc.impressions += coerceMetric(row.impressions);
      acc.reach += coerceMetric(row.reach);
      acc.engagements += coerceMetric(row.engagements);
      acc.views += coerceMetric(row.views);
      acc.watch_time += coerceMetric(row.watch_time);
      acc.posts_count += coerceMetric(row.posts_count);
      return acc;
    },
    {
      followers: followersCurrent,
      impressions: 0,
      reach: 0,
      engagements: 0,
      views: 0,
      watch_time: 0,
      posts_count: 0,
    }
  );

  const prevTotals = (prevMetrics ?? []).reduce(
    (acc, row) => {
      acc.impressions += coerceMetric(row.impressions);
      acc.reach += coerceMetric(row.reach);
      acc.engagements += coerceMetric(row.engagements);
      acc.views += coerceMetric(row.views);
      acc.watch_time += coerceMetric(row.watch_time);
      acc.posts_count += coerceMetric(row.posts_count);
      return acc;
    },
    {
      followers: followersPrev,
      impressions: 0,
      reach: 0,
      engagements: 0,
      views: 0,
      watch_time: 0,
      posts_count: 0,
    }
  );

  // Calculate deltas
  const calcDelta = (current: number, previous: number) =>
    previous ? ((current - previous) / previous) * 100 : 0;

  const delta = {
    followers: calcDelta(totals.followers, prevTotals.followers),
    impressions: calcDelta(totals.impressions, prevTotals.impressions),
    reach: calcDelta(totals.reach, prevTotals.reach),
    engagements: calcDelta(totals.engagements, prevTotals.engagements),
    views: calcDelta(totals.views, prevTotals.views),
    posts_count: calcDelta(totals.posts_count, prevTotals.posts_count),
  };


  // Build platform summaries
  const platformsSet = new Set(
    (metrics ?? []).map((row) => row.platform).filter(Boolean)
  );
  const platforms = Array.from(platformsSet).map((p) => {
    const currentRows = (metrics ?? []).filter((row) => row.platform === p);
    const prevRows = (prevMetrics ?? []).filter((row) => row.platform === p);

    const currentFollowers = sumLatestFollowers(currentRows);
    const prevFollowers = sumLatestFollowers(prevRows);

    const platformTotals = currentRows.reduce(
      (acc, row) => {
        acc.impressions += coerceMetric(row.impressions);
        acc.reach += coerceMetric(row.reach);
        acc.engagements += coerceMetric(row.engagements);
        acc.views += coerceMetric(row.views);
        acc.posts_count += coerceMetric(row.posts_count);
        return acc;
      },
      { followers: currentFollowers, impressions: 0, reach: 0, engagements: 0, views: 0, posts_count: 0 }
    );

    const platformPrevTotals = prevRows.reduce(
      (acc, row) => {
        acc.impressions += coerceMetric(row.impressions);
        acc.reach += coerceMetric(row.reach);
        acc.engagements += coerceMetric(row.engagements);
        acc.views += coerceMetric(row.views);
        acc.posts_count += coerceMetric(row.posts_count);
        return acc;
      },
      { followers: prevFollowers, impressions: 0, reach: 0, engagements: 0, views: 0, posts_count: 0 }
    );

    return {
      platform: p as string,
      totals: platformTotals,
      delta: {
        followers: calcDelta(platformTotals.followers, platformPrevTotals.followers),
        views: calcDelta(platformTotals.views, platformPrevTotals.views),
        reach: calcDelta(platformTotals.reach, platformPrevTotals.reach),
        engagements: calcDelta(platformTotals.engagements, platformPrevTotals.engagements),
        posts_count: calcDelta(platformTotals.posts_count, platformPrevTotals.posts_count),
      },
    };
  });

  // Fetch top posts
  const { data: posts } = await supabase
    .from("social_posts")
    .select("caption,posted_at,metrics")
    .eq("tenant_id", tenantId)
    .gte("posted_at", range.start.toISOString())
    .lte("posted_at", range.end.toISOString())
    .order("posted_at", { ascending: false })
    .limit(20);

  const sortedPosts = (posts ?? [])
    .sort((a, b) => {
      const aImp = getPostImpressions(a.metrics);
      const bImp = getPostImpressions(b.metrics);
      const aEng = getPostEngagements(a.metrics);
      const bEng = getPostEngagements(b.metrics);
      return bImp - aImp || bEng - aEng;
    })
    .filter((post) => {
      return getPostVisibility(post.metrics).value > 0 || getPostEngagements(post.metrics) > 0;
    })
    .slice(0, 8)
    .map((post) => ({
      caption: post.caption ?? "Sans titre",
      date: post.posted_at
        ? new Date(post.posted_at).toLocaleDateString("fr-FR")
        : "-",
      visibility: getPostVisibility(post.metrics),
      engagements: getPostEngagements(post.metrics),
    }));

  const displayPosts = sortedPosts.length
    ? sortedPosts
    : (posts ?? [])
        .sort((a, b) => {
          const aImp = getPostImpressions(a.metrics);
          const bImp = getPostImpressions(b.metrics);
          const aEng = getPostEngagements(a.metrics);
          const bEng = getPostEngagements(b.metrics);
          return bImp - aImp || bEng - aEng;
        })
        .slice(0, 8)
        .map((post) => ({
          caption: post.caption ?? "Sans titre",
          date: post.posted_at
            ? new Date(post.posted_at).toLocaleDateString("fr-FR")
            : "-",
          visibility: getPostVisibility(post.metrics),
          engagements: getPostEngagements(post.metrics),
        }));

  // Fetch collaboration data
  const { data: collaboration } = await supabase
    .from("collaboration")
    .select("shoot_days_remaining")
    .eq("tenant_id", tenantId)
    .single();

  const { data: shoots } = await supabase
    .from("upcoming_shoots")
    .select("shoot_date,location")
    .eq("tenant_id", tenantId)
    .order("shoot_date", { ascending: true })
    .limit(5);

  const { data: documents } = await supabase
    .from("documents")
    .select("file_name,tag")
    .eq("tenant_id", tenantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  // Format rate for engagement
  const engagementRate = totals.views
    ? (totals.engagements / totals.views) * 100
    : 0;
  const prevEngagementRate = prevTotals.views
    ? (prevTotals.engagements / prevTotals.views) * 100
    : 0;
  const engagementDelta = calcDelta(engagementRate, prevEngagementRate);

  // Build KPIs
  const kpis = [
    { label: "Abonnés", value: totals.followers, delta: delta.followers },
    { label: "Vues", value: totals.views, delta: delta.views },
    { label: "Portée", value: totals.reach, delta: delta.reach },
    { label: "Engagements", value: totals.engagements, delta: delta.engagements },
    { label: "Publications", value: totals.posts_count, delta: delta.posts_count },
    {
      label: "Taux d'engagement",
      value: Math.round(engagementRate * 10) / 10,
      delta: engagementDelta,
      suffix: "%",
    },
  ];

  const documentProps: PdfDocumentProps = {
    tenantName: tenant?.name ?? "Client",
    rangeLabel: `${range.start.toLocaleDateString("fr-FR")} - ${range.end.toLocaleDateString("fr-FR")}`,
    prevRangeLabel: `${prevRange.start.toLocaleDateString("fr-FR")} - ${prevRange.end.toLocaleDateString("fr-FR")}`,
    generatedAt: new Date().toLocaleString("fr-FR"),
    kpis,
    platforms,
    posts: displayPosts,
    shootDays: collaboration?.shoot_days_remaining ?? 0,
    shoots: (shoots ?? []).map((shoot) => ({
      date: new Date(shoot.shoot_date).toLocaleDateString("fr-FR"),
      location: shoot.location ?? "",
    })),
    documents: (documents ?? []).map((doc) => ({
      name: doc.file_name,
      tag: doc.tag,
    })),
  };

  try {
    const pdfBuffer = await renderToBuffer(PdfDocument(documentProps));

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=jumpstart-${tenant?.name ?? "client"}.pdf`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF generation failed";
    console.error("[pdf] generation failed", error);
    return Response.json({ error: message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
