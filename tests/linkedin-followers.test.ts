import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildHeaders, normalizeOrganizationId } from "../lib/social-platforms/linkedin/api";
import { getLinkedInVersion, LINKEDIN_CONFIG } from "../lib/social-platforms/linkedin/config";
import {
  buildPostAnalyticsWindow,
  buildOrganizationAuthorizationActionsParam,
  buildOrganizationPageEntityParam,
  pickPreferredPageProfileElement,
} from "../lib/social-platforms/linkedin/dma";

describe("LinkedIn DMA helpers", () => {
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
  });

  test("uses the DMA OAuth scope", () => {
    assert.deepEqual(LINKEDIN_CONFIG.scopes, ["r_dma_admin_pages_content"]);
  });

  test("formats authorizationActions with raw Rest.li syntax", () => {
    const value = buildOrganizationAuthorizationActionsParam(
      "FOLLOWER_ANALYTICS_READ"
    );

    assert.equal(
      value,
      "List((authorizationAction:(organizationAnalyticsAuthorizationAction:(actionType:FOLLOWER_ANALYTICS_READ))))"
    );
    assert.equal(value.includes("%"), false);
  });

  test("formats pageEntity with raw Rest.li wrapper and encoded URN", () => {
    assert.equal(
      buildOrganizationPageEntityParam("urn:li:organization:12345"),
      "(organization:urn%3Ali%3Aorganization%3A12345)"
    );
  });

  test("prefers the explicit organizational page when multiple page profiles are returned", () => {
    const selected = pickPreferredPageProfileElement(
      [
        { entityUrn: "urn:li:organizationalPage:27", localizedName: "Wrong page" },
        { entityUrn: "urn:li:organizationalPage:4000", localizedName: "Correct page" },
      ],
      "urn:li:organizationalPage:4000"
    );

    assert.equal(selected?.entityUrn, "urn:li:organizationalPage:4000");
  });

  test("prefers vanity-matched page profile over a stale preferred page urn", () => {
    const selected = pickPreferredPageProfileElement(
      [
        {
          entityUrn: "urn:li:organizationalPage:27",
          localizedName: "Ecosysteme Digital Product",
          pageUrl: "https://www.linkedin.com/company/ecosysteme-digital-product/",
        },
        {
          entityUrn: "urn:li:organizationalPage:4000",
          localizedName: "Ecosysteme Digital",
          pageUrl: "https://www.linkedin.com/company/ecosysteme-digital/",
        },
      ],
      "urn:li:organizationalPage:27",
      "Ecosysteme Digital",
      undefined,
      "ecosysteme-digital"
    );

    assert.equal(selected?.entityUrn, "urn:li:organizationalPage:4000");
  });
});

describe("LinkedIn version normalization", () => {
  test("returns undefined for empty/auto value", () => {
    const previous = process.env.LINKEDIN_VERSION;

    delete process.env.LINKEDIN_VERSION;
    assert.equal(getLinkedInVersion(), undefined);

    process.env.LINKEDIN_VERSION = "auto";
    assert.equal(getLinkedInVersion(), undefined);

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

describe("LinkedIn post analytics window", () => {
  test("skips DMA post trend requests for posts newer than one day", () => {
    const now = new Date("2026-03-26T17:20:00.000Z");
    const postedAt = new Date("2026-03-26T12:00:00.000Z").getTime();

    assert.equal(buildPostAnalyticsWindow(postedAt, now), null);
  });

  test("normalizes older posts to whole-day bounds", () => {
    const now = new Date("2026-03-26T17:20:00.000Z");
    const postedAt = new Date("2026-03-24T12:00:00.000Z").getTime();

    assert.deepEqual(buildPostAnalyticsWindow(postedAt, now), {
      since: new Date("2026-03-24T00:00:00.000Z"),
      until: new Date("2026-03-26T23:59:59.999Z"),
    });
  });
});
