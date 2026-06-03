import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("AI content ideas are parked for dashboard V3 by default", () => {
  const dashboardPage = readFileSync("app/(client)/client/dashboard/page.tsx", "utf8");
  const aiCard = readFileSync("components/dashboard/ai-content-ideas-card.tsx", "utf8");
  const route = readFileSync("app/api/client/content-ideas/route.ts", "utf8");
  const envExample = readFileSync(".env.example", "utf8");

  assert.doesNotMatch(dashboardPage, /AiContentIdeasCard/);
  assert.match(route, /OPENAI_CONTENT_IDEAS_ENABLED !== "true"/);
  assert.match(route, /content_ideas_disabled/);
  assert.match(envExample, /OPENAI_CONTENT_IDEAS_ENABLED=false/);
  assert.match(aiCard, /useEffect\(\(\) => \{\s*setIdeas\(\[\]\);/);
  assert.match(aiCard, /\}, \[activeQuery\]\)/);
  assert.match(aiCard, /query: requestQuery/);
});
