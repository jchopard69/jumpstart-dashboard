import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToBuffer } from "@react-pdf/renderer";
import { PdfDocument } from "../lib/pdf-document";

test("PdfDocument renders with demo watermark", async () => {
  const buffer = await renderToBuffer(
    PdfDocument({
      tenantName: "JumpStart Demo",
      rangeLabel: "01/01/2026 - 31/01/2026",
      prevRangeLabel: "01/12/2025 - 31/12/2025",
      generatedAt: "01/02/2026 10:00",
      kpis: [
        { label: "Abonnés", value: 10000, delta: 4.2 },
        { label: "Vues", value: 58000, delta: 8.1 },
      ],
      platforms: [
        {
          platform: "instagram",
          totals: { followers: 7000, views: 31000, reach: 24000, engagements: 2400, posts_count: 9 },
          delta: { followers: 3.8, views: 9.3, reach: 6.4, engagements: 7.1, posts_count: 12 },
        },
      ],
      posts: [
        {
          caption: "Demo content",
          date: "29/01/2026",
          visibility: { label: "Vues", value: 4200 },
          engagements: 210,
        },
      ],
      shootDays: 4,
      shoots: [{ date: "15/02/2026", location: "Paris Studio" }],
      documents: [{ name: "Brief strategic", tag: "brief" }],
      watermark: "DEMO",
    })
  );

  assert.ok(buffer.byteLength > 1000);
});

