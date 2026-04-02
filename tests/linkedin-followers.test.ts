import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildHeaders, normalizeOrganizationId } from "../lib/social-platforms/linkedin/api";
import {
  generateOAuthState,
  handleLinkedInOAuthCallback,
} from "../lib/social-platforms/linkedin/auth";
import {
  DEFAULT_LINKEDIN_VERSION,
  getLinkedInVersion,
  LINKEDIN_CONFIG,
} from "../lib/social-platforms/linkedin/config";

describe("LinkedIn Community helpers", () => {
  test("normalizeOrganizationId strips organization URN", () => {
    assert.equal(normalizeOrganizationId("urn:li:organization:12345"), "12345");
  });

  test("normalizeOrganizationId strips organizationalPage URN", () => {
    assert.equal(normalizeOrganizationId("urn:li:organizationalPage:67890"), "67890");
  });

  test("normalizeOrganizationId keeps raw id", () => {
    assert.equal(normalizeOrganizationId("3866335"), "3866335");
  });

  test("buildHeaders always includes OAuth and Rest.li headers", () => {
    const headers = buildHeaders("token-xyz");
    assert.equal(headers.Authorization, "Bearer token-xyz");
    assert.equal(headers["X-Restli-Protocol-Version"], "2.0.0");
    assert.equal(headers["LinkedIn-Version"], DEFAULT_LINKEDIN_VERSION);
  });

  test("uses Community Management OAuth scopes only", () => {
    assert.deepEqual(LINKEDIN_CONFIG.scopes, [
      "rw_organization_admin",
      "r_organization_social",
    ]);
  });
});

describe("LinkedIn version normalization", () => {
  test("defaults to the 2026-03 marketing version when env is empty or auto", () => {
    const previous = process.env.LINKEDIN_VERSION;

    delete process.env.LINKEDIN_VERSION;
    assert.equal(getLinkedInVersion(), DEFAULT_LINKEDIN_VERSION);

    process.env.LINKEDIN_VERSION = "auto";
    assert.equal(getLinkedInVersion(), DEFAULT_LINKEDIN_VERSION);

    if (previous === undefined) delete process.env.LINKEDIN_VERSION;
    else process.env.LINKEDIN_VERSION = previous;
  });

  test("normalizes date-like versions to YYYYMM", () => {
    const previous = process.env.LINKEDIN_VERSION;

    process.env.LINKEDIN_VERSION = "2025-11-01";
    assert.equal(getLinkedInVersion(), "202511");

    process.env.LINKEDIN_VERSION = "202511";
    assert.equal(getLinkedInVersion(), "202511");

    if (previous === undefined) delete process.env.LINKEDIN_VERSION;
    else process.env.LINKEDIN_VERSION = previous;
  });
});

describe("LinkedIn follower cumsum behavior", () => {
  function applyCumsum(
    metrics: Array<{ date: string; followers?: number }>,
    baseline: number
  ) {
    const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date));
    const lastEntry = sorted[sorted.length - 1];
    const lastValue = lastEntry?.followers ?? 0;
    const dailyGains = sorted.slice(0, -1);
    const maxDailyGain = dailyGains.reduce((max, m) => Math.max(max, m.followers ?? 0), 0);

    const lastIsAbsoluteTotal = lastValue > 1 && (dailyGains.length === 0 || lastValue > maxDailyGain * 10);

    if (lastIsAbsoluteTotal && lastValue > 0) {
      let cumulative = baseline;
      for (const metric of dailyGains) {
        cumulative += metric.followers ?? 0;
        metric.followers = cumulative;
      }
      lastEntry.followers = Math.max(lastValue, baseline);
      return sorted;
    }

    let cumulative = baseline;
    for (const metric of sorted) {
      cumulative += metric.followers ?? 0;
      metric.followers = cumulative;
    }
    return sorted;
  }

  test("keeps absolute followers anchor on latest day", () => {
    const result = applyCumsum(
      [
        { date: "2026-01-01", followers: 3 },
        { date: "2026-01-02", followers: 4 },
        { date: "2026-01-03", followers: 4437 },
      ],
      0
    );

    assert.equal(result[0].followers, 3);
    assert.equal(result[1].followers, 7);
    assert.equal(result[2].followers, 4437);
  });

  test("treats all small values as gains", () => {
    const result = applyCumsum(
      [
        { date: "2026-01-01", followers: 1 },
        { date: "2026-01-02", followers: 2 },
        { date: "2026-01-03", followers: 3 },
      ],
      10
    );

    assert.equal(result[0].followers, 11);
    assert.equal(result[1].followers, 13);
    assert.equal(result[2].followers, 16);
  });
});

describe("LinkedIn OAuth callback resilience", () => {
  test("falls back to unresolved organization contexts when organizations batch is throttled", async () => {
    const previousClientId = process.env.LINKEDIN_CLIENT_ID;
    const previousClientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    const previousVersion = process.env.LINKEDIN_VERSION;

    process.env.LINKEDIN_CLIENT_ID = "linkedin-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-client-secret";
    process.env.LINKEDIN_VERSION = "202603";

    const state = generateOAuthState("tenant-xyz");
    const originalFetch = global.fetch;

    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "https://www.linkedin.com/oauth/v2/accessToken") {
        assert.equal(init?.method, "POST");
        return new Response(
          JSON.stringify({
            access_token: "linkedin-token",
            expires_in: 3600,
            scope: "r_organization_social rw_organization_admin",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/organizationAcls?q=roleAssignee")) {
        return new Response(
          JSON.stringify({
            elements: [{ organizationTarget: "urn:li:organization:3866335" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/organizations?ids=List(3866335)")) {
        return new Response(
          JSON.stringify({
            status: 429,
            serviceErrorCode: 101,
            code: "TOO_MANY_REQUESTS",
            message: "Resource level throttle APPLICATION DAY limit for calls to this resource is reached.",
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const result = await handleLinkedInOAuthCallback("oauth-code", state);

      assert.equal(result.tenantId, "tenant-xyz");
      assert.equal(result.accounts.length, 1);
      assert.equal(result.accounts[0].platformUserId, "3866335");
      assert.equal(result.accounts[0].accountName, "LinkedIn organization 3866335");
      assert.deepEqual(result.accounts[0].metadata, {
        accountType: "organization",
        organizationId: "3866335",
        organizationUrn: "urn:li:organization:3866335",
        pageUrl: undefined,
      });
    } finally {
      global.fetch = originalFetch;
      if (previousClientId === undefined) delete process.env.LINKEDIN_CLIENT_ID;
      else process.env.LINKEDIN_CLIENT_ID = previousClientId;
      if (previousClientSecret === undefined) delete process.env.LINKEDIN_CLIENT_SECRET;
      else process.env.LINKEDIN_CLIENT_SECRET = previousClientSecret;
      if (previousVersion === undefined) delete process.env.LINKEDIN_VERSION;
      else process.env.LINKEDIN_VERSION = previousVersion;
    }
  });
});
