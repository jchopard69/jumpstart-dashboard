import type { UserRole } from "./types";

export const TENANT_COOKIE = "active_tenant_id";

export function pickActiveTenantId(params: {
  accessibleTenantIds: string[];
  requestedTenantId?: string | null;
  cookieTenantId?: string | null;
  primaryTenantId?: string | null;
  role?: UserRole | null;
}): string | null {
  const {
    accessibleTenantIds,
    requestedTenantId,
    cookieTenantId,
    primaryTenantId,
    role,
  } = params;

  if (role === "agency_admin") {
    return requestedTenantId ?? primaryTenantId ?? null;
  }

  const tenantIds = new Set(accessibleTenantIds.filter(Boolean));

  if (requestedTenantId && tenantIds.has(requestedTenantId)) {
    return requestedTenantId;
  }

  if (cookieTenantId && tenantIds.has(cookieTenantId)) {
    return cookieTenantId;
  }

  if (primaryTenantId) {
    return primaryTenantId;
  }

  return accessibleTenantIds[0] ?? null;
}

export function canManageReportSchedules(role?: UserRole | null): boolean {
  return role === "agency_admin" || role === "client_manager";
}
