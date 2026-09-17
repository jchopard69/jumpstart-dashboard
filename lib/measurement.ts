/** Parse observed measurements without turning missing or invalid values into zeros. */
export function observedNumber(value: unknown): number | null {
  if (value == null || typeof value === 'boolean' || (typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export type MeasurementKey = 'followers' | 'views' | 'reach' | 'engagements';
export type MeasuredFields = Record<MeasurementKey, boolean>;
export function measuredFields(rows: Array<{platform?: string | null; followers?: number | null; views?: number | null; reach?: number | null; engagements?: number | null}>, platform: string): MeasuredFields {
  const selected = rows.filter(row => row.platform === platform);
  return Object.fromEntries(['followers','views','reach','engagements'].map(key => [key, selected.some(row => observedNumber(row[key as MeasurementKey]) != null)])) as MeasuredFields;
}
