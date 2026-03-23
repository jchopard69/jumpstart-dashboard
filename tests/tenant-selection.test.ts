import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canManageReportSchedules,
  pickActiveTenantId,
} from "../lib/tenant-selection";

test("pickActiveTenantId prefers an authorized requested tenant", () => {
  const tenantId = pickActiveTenantId({
    accessibleTenantIds: ["tenant-a", "tenant-b"],
    requestedTenantId: "tenant-b",
    cookieTenantId: "tenant-a",
    primaryTenantId: "tenant-a",
    role: "client_manager",
  });

  assert.equal(tenantId, "tenant-b");
});

test("pickActiveTenantId falls back to the cookie before the primary tenant", () => {
  const tenantId = pickActiveTenantId({
    accessibleTenantIds: ["tenant-a", "tenant-b"],
    cookieTenantId: "tenant-b",
    primaryTenantId: "tenant-a",
    role: "client_user",
  });

  assert.equal(tenantId, "tenant-b");
});

test("pickActiveTenantId falls back to the primary tenant when needed", () => {
  const tenantId = pickActiveTenantId({
    accessibleTenantIds: ["tenant-a"],
    requestedTenantId: "tenant-x",
    primaryTenantId: "tenant-a",
    role: "client_user",
  });

  assert.equal(tenantId, "tenant-a");
});

test("pickActiveTenantId lets admins target the requested tenant directly", () => {
  const tenantId = pickActiveTenantId({
    accessibleTenantIds: [],
    requestedTenantId: "tenant-b",
    primaryTenantId: null,
    role: "agency_admin",
  });

  assert.equal(tenantId, "tenant-b");
});

test("canManageReportSchedules only allows managers and admins", () => {
  assert.equal(canManageReportSchedules("client_user"), false);
  assert.equal(canManageReportSchedules("client_manager"), true);
  assert.equal(canManageReportSchedules("agency_admin"), true);
});
