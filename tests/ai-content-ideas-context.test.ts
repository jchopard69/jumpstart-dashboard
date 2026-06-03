import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("AI content ideas are scoped to the active dashboard tenant context", () => {
  const dashboardPage = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const aiCard = readFileSync("components/dashboard/ai-content-ideas-card.tsx", "utf8");
  const route = readFileSync("app/api/client/content-ideas/route.ts", "utf8");

  assert.match(dashboardPage, /aiQueryParams\.set\("tenantId", effectiveTenantId\)/);
  assert.match(dashboardPage, /<AiContentIdeasCard tenantId=\{effectiveTenantId\} initialQuery=\{aiQueryString\}/);
  assert.match(aiCard, /useEffect\(\(\) => \{\s*setIdeas\(\[\]\);/);
  assert.match(aiCard, /\}, \[activeQuery\]\)/);
  assert.match(aiCard, /query: requestQuery/);
  assert.match(route, /context:\s*\{\s*tenantId,/);
});
