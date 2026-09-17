/** Only scalar API measurements are accepted: missing values are not zero. */
export function insightValue(metric: unknown): number | undefined {
  if (!metric || typeof metric !== 'object') return undefined;
  const row = metric as { values?: { value?: unknown }[]; total_value?: { value?: unknown }; value?: unknown };
  const value = row.values?.[0]?.value ?? row.total_value?.value ?? row.value;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

type InsightResponse = { data?: { name?: string; values?: { value?: unknown }[]; total_value?: { value?: unknown }; value?: unknown }[] };
export type InsightRequest = (metrics: string[]) => Promise<InsightResponse>;
const instagramMetrics: Record<string, string> = { views: 'views', reach: 'reach', total_interactions: 'engagements', saved: 'saves', shares: 'shares' };
const facebookMetrics: Record<string, string> = { post_media_view: 'views', post_total_media_view_unique: 'viewers' };

/** A rejected metric on one post must never disable insights for other posts. */
export async function collectPostInsights(platform: 'instagram' | 'facebook', request: InsightRequest, story = false): Promise<Record<string, number>> {
  const fields = platform === 'instagram' ? instagramMetrics : facebookMetrics;
  const metrics = Object.keys(fields).filter(key => !story || key !== 'saved');
  const result: Record<string, number> = {};
  const apply = (response: InsightResponse, requested: string[]) => {
    for (const row of response.data ?? []) {
      const name = row.name ?? (requested.length === 1 ? requested[0] : '');
      const value = insightValue(row);
      if (fields[name] && value !== undefined) result[fields[name]] = value;
    }
  };
  try {
    apply(await request(metrics), metrics);
  } catch (error) {
    // Auth, quota and network failures do not justify multiplying requests.
    const message = error instanceof Error ? error.message : String(error);
    if (!/valid insights metric|no longer supported|invalid parameter|2108006|not supported|nonexisting field/i.test(message)) return result;
    for (const metric of metrics) {
      try { apply(await request([metric]), [metric]); } catch { /* Keep successful siblings. */ }
    }
  }
  return result;
}

const visibilityKeys = ['views', 'reach', 'impressions', 'viewers', 'media_views', 'plays', 'video_views'];
/** Preserve the last observation on failed/empty reads, without preserving legacy FB aliases. */
export function mergeMetaPostMetrics(platform: string, incoming: Record<string, unknown>, previous: Record<string, unknown>, now = Date.now()): Record<string, unknown> {
  const merged = { ...previous, ...incoming };
  if (platform === 'facebook' && previous._visibility_version !== 2) {
    // The old collector copied views into reach/impressions/media_views.
    for (const key of ['reach', 'impressions', 'media_views']) delete merged[key];
  }
  for (const key of visibilityKeys) {
    const value = incoming[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      merged[key] = value;
      merged[`_${key}_collected_at`] = now;
    } else {
      const old = previous[key];
      const legacyAlias = platform === 'facebook' && previous._visibility_version !== 2 && ['reach','impressions','media_views'].includes(key);
      if (!legacyAlias && typeof old === 'number' && Number.isFinite(old) && (old > 0 || (old === 0 && previous[`_${key}_collected_at`]))) merged[key] = old;
      else delete merged[key];
    }
  }
  merged._visibility_version = 2;
  if (incoming._visibility_checked_at) merged._visibility_checked_at = incoming._visibility_checked_at;
  return merged;
}

export function prioritizePostInsights<T extends {id:string}>(posts: T[], checked: Record<string, number> = {}): T[] {
  return [...posts].sort((a,b) => (checked[a.id] ?? 0) - (checked[b.id] ?? 0));
}
