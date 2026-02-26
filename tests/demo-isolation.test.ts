import assert from "node:assert/strict";
import { test } from "node:test";
import { enforceDemoTenantIsolation } from "../lib/demo";

test("enforceDemoTenantIsolation keeps only demo tenants for demo primary tenant", () => {
  const tenants = [
    { id: "demo-1", is_demo: true, name: "Demo", slug: "demo" },
    { id: "real-1", is_demo: false, name: "Client A", slug: "client-a" },
  ];

  const result = enforceDemoTenantIsolation(tenants, "demo-1", "client_user");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "demo-1");
});

test("enforceDemoTenantIsolation does not filter for admins", () => {
  const tenants = [
    { id: "demo-1", is_demo: true, name: "Demo", slug: "demo" },
    { id: "real-1", is_demo: false, name: "Client A", slug: "client-a" },
  ];

  const result = enforceDemoTenantIsolation(tenants, "demo-1", "agency_admin");
  assert.equal(result.length, 2);
});

