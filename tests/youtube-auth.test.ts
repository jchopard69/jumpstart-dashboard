import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  generateOAuthState,
  handleYouTubeOAuthCallback,
  parseOAuthState,
} from "../lib/social-platforms/youtube/auth";

describe("YouTube OAuth state", () => {
  test("signed state round-trips tenant and return origin", () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const previousEncryptionSecret = process.env.ENCRYPTION_SECRET;

    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.ENCRYPTION_SECRET = "encryption-secret";

    const state = generateOAuthState(
      "tenant-123",
      "https://dashboard.jumpstartstudio.fr"
    );
    const parsed = parseOAuthState(state);

    assert.equal(parsed.tenantId, "tenant-123");
    assert.equal(parsed.returnToOrigin, "https://dashboard.jumpstartstudio.fr");
    assert.equal(parsed.signed, true);

    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
    if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    if (previousEncryptionSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = previousEncryptionSecret;
  });
});

describe("YouTube OAuth callback", () => {
  test("imports all accessible channels, including brand channels", async () => {
    const previousClientId = process.env.GOOGLE_CLIENT_ID;
    const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const previousEncryptionSecret = process.env.ENCRYPTION_SECRET;

    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.ENCRYPTION_SECRET = "encryption-secret";

    const state = generateOAuthState(
      "tenant-abc",
      "https://dashboard.jumpstartstudio.fr"
    );

    const originalFetch = global.fetch;
    let fetchCount = 0;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCount += 1;
      const url = String(input);

      if (url === "https://oauth2.googleapis.com/token") {
        assert.equal(init?.method, "POST");
        return new Response(
          JSON.stringify({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/youtube/v3/channels?")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "UCPRIMARY",
                snippet: {
                  title: "Primary Channel",
                  description: "Primary",
                  thumbnails: {
                    medium: { url: "https://img.example.com/primary.jpg" },
                  },
                },
                statistics: {
                  subscriberCount: "4519",
                  viewCount: "15909",
                  videoCount: "42",
                },
              },
              {
                id: "UCBRAND",
                snippet: {
                  title: "Brand Channel",
                  description: "Brand",
                  thumbnails: {
                    medium: { url: "https://img.example.com/brand.jpg" },
                  },
                },
                statistics: {
                  subscriberCount: "1200",
                  viewCount: "48000",
                  videoCount: "18",
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }) as typeof fetch;

    try {
      const result = await handleYouTubeOAuthCallback("auth-code", state);

      assert.equal(fetchCount, 2);
      assert.equal(result.tenantId, "tenant-abc");
      assert.equal(result.returnToOrigin, "https://dashboard.jumpstartstudio.fr");
      assert.equal(result.accounts.length, 2);
      assert.deepEqual(
        result.accounts.map((account) => ({
          id: account.platformUserId,
          name: account.accountName,
        })),
        [
          { id: "UCPRIMARY", name: "Primary Channel" },
          { id: "UCBRAND", name: "Brand Channel" },
        ]
      );
      assert.equal(result.accounts[0].refreshToken, "refresh-token");
    } finally {
      global.fetch = originalFetch;
      if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousClientId;
      if (previousClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
      if (previousEncryptionSecret === undefined) delete process.env.ENCRYPTION_SECRET;
      else process.env.ENCRYPTION_SECRET = previousEncryptionSecret;
    }
  });
});
