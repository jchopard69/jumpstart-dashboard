import type { SupabaseClient } from "@supabase/supabase-js";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  is_demo?: boolean | null;
};

export class DemoTenantWriteError extends Error {
  status = 403;
  code = "demo_tenant_write_blocked";

  constructor(message = "Action non autorisee en mode demo.") {
    super(message);
    this.name = "DemoTenantWriteError";
  }
}

export function isDemoEnabled(): boolean {
  return (process.env.DEMO_ENABLED ?? "false") === "true";
}

export function getDemoTenantSlug(): string {
  return process.env.DEMO_TENANT_SLUG?.trim() || "demo";
}

export function getDemoContactEmail(): string {
  return process.env.DEMO_CONTACT_EMAIL?.trim() || "contact@jumpstartstudio.fr";
}

export function getDemoContactHref(): string {
  const email = getDemoContactEmail();
  const subject = encodeURIComponent("Demande de démo personnalisée");
  return `mailto:${email}?subject=${subject}`;
}

export function getDemoExpiryDate(): Date | null {
  const raw = process.env.DEMO_ACCESS_EXPIRES_AT?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDemoAccessExpired(now: Date = new Date()): boolean {
  const expiry = getDemoExpiryDate();
  if (!expiry) return false;
  return now.getTime() > expiry.getTime();
}

export function getDemoCredentials(): { email: string; password: string } {
  const email = process.env.DEMO_USER_EMAIL?.trim() || "demo@jumpstart.studio";
  const password = process.env.DEMO_USER_PASSWORD?.trim();
  if (!password) {
    throw new Error("DEMO_USER_PASSWORD est requis.");
  }
  return { email, password };
}

export function shouldUseDemoPdfWatermark(): boolean {
  return (process.env.DEMO_PDF_WATERMARK ?? "true") !== "false";
}

export function getDemoPdfWatermarkText(): string {
  return process.env.DEMO_PDF_WATERMARK_TEXT?.trim() || "DEMO";
}

export function logDemoAccess(
  event: string,
  details: Record<string, unknown> = {}
) {
  console.info("[demo_access]", {
    event,
    at: new Date().toISOString(),
    ...details,
  });
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

async function readTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<TenantRow | null> {
  let supabase = client;
  if (!supabase) {
    const serverModule = await import("./supabase/server");
    supabase = serverModule.createSupabaseServiceClient();
  }
  const { data } = await supabase
    .from("tenants")
    .select("id,slug,name,is_demo")
    .eq("id", tenantId)
    .maybeSingle();
  return (data as TenantRow | null) ?? null;
}

export async function getTenantDemoInfo(
  tenantId: string,
  client?: SupabaseClient
): Promise<{ isDemo: boolean; slug?: string; name?: string }> {
  const tenant = await readTenant(tenantId, client);
  if (!tenant) return { isDemo: false };
  return {
    isDemo: Boolean(tenant.is_demo),
    slug: tenant.slug,
    name: tenant.name,
  };
}

export async function isDemoTenant(
  tenantId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const info = await getTenantDemoInfo(tenantId, client);
  return info.isDemo;
}

export async function assertTenantNotDemoWritable(
  tenantId: string,
  action: string,
  client?: SupabaseClient
) {
  const info = await getTenantDemoInfo(tenantId, client);
  if (!info.isDemo) return;
  logDemoAccess("blocked_write", { tenantId, tenantSlug: info.slug, action });
  throw new DemoTenantWriteError(
    "Ce workspace est en mode démo. Les modifications sont désactivées."
  );
}

export function enforceDemoTenantIsolation<T extends { id: string; is_demo?: boolean | null }>(
  tenants: T[],
  primaryTenantId: string | null,
  role?: string | null
): T[] {
  if (!primaryTenantId || role === "agency_admin") {
    return tenants;
  }

  const primary = tenants.find((tenant) => tenant.id === primaryTenantId);
  if (!primary || !primary.is_demo) {
    return tenants;
  }

  return tenants.filter((tenant) => Boolean(tenant.is_demo));
}
