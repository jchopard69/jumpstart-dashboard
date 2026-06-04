import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("YouTube OAuth callback triggers an initial YouTube sync", () => {
  const callbackRoute = readFileSync("app/api/oauth/youtube/callback/route.ts", "utf8");
  const adminConnections = readFileSync("components/admin/platform-connections.tsx", "utf8");

  assert.match(callbackRoute, /import \{ runTenantSync \} from "@\/lib\/sync"/);
  assert.match(callbackRoute, /await runTenantSync\(tenantId, "youtube"\)/);
  assert.match(callbackRoute, /youtube_sync_warning/);
  assert.match(adminConnections, /type: "success" \| "warning" \| "error"/);
  assert.match(adminConnections, /youtube_sync_warning/);
});
