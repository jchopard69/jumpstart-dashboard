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
      actionPlan: [
        {
          id: "data-tiktok",
          priority: "high",
          horizon: "Aujourd'hui",
          title: "Réparer les données TikTok",
          rationale: "La portée absente fragilise le score et les recommandations client.",
          metric: "0% de couverture",
        },
      ],
      opportunities: [
        {
          id: "replicate-engagement-winner",
          title: "Répliquer le format gagnant Instagram",
          automation: "Créer automatiquement 3 variations de brief à partir du post le plus engageant.",
          impact: "Accélérer la production des contenus qui génèrent déjà de l'interaction.",
          evidence: "2 400 engagements détectés",
          confidence: "Haute",
        },
      ],
      clientNextActions: [
        {
          id: "dashboard-data-tiktok",
          label: "A traiter",
          title: "Réparer les données TikTok",
          detail: "Les décisions clients sont fragilisées tant que cette source n'est pas fiable.",
          proof: "0% de couverture",
          href: "#dashboard-operations",
          priority: "high",
        },
      ],
      contentDna: [
        {
          label: "Reels",
          insight: "Les reels sont votre format gagnant",
          detail: "2x plus d'engagement que les images",
          strength: 78,
        },
      ],
      contentBriefs: [
        {
          title: "Transformer le meilleur pattern en preuve client",
          angle: "Reprendre le format gagnant pour montrer un résultat concret.",
          format: "Reels",
          timing: "18h-22h",
          captionGuidance: "Captions moyennes",
          automation: "Préparer automatiquement un brief avec hook, preuve et CTA.",
        },
      ],
      dataQuality: {
        overallCoverage: 86,
        expectedDays: 31,
        staleSync: false,
        actions: [],
        platformQuality: [
          {
            platform: "instagram",
            accounts: 1,
            coveredDays: 30,
            expectedDays: 31,
            coverage: 97,
            status: "good",
            missingMetrics: [],
          },
          {
            platform: "tiktok",
            accounts: 1,
            coveredDays: 18,
            expectedDays: 31,
            coverage: 58,
            status: "partial",
            missingMetrics: ["reach"],
          },
        ],
      },
      watermark: "DEMO",
    })
  );

  assert.ok(buffer.byteLength > 1000);
});
