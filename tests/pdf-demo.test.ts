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
      opportunities: [
        {
          id: "replicate-engagement-winner",
          title: "Répliquer le format gagnant Instagram",
          automation: "Prioriser ce format dans la prochaine production et tester une variation courte avec le même angle.",
          impact: "Accélérer la production des contenus qui génèrent déjà de l'interaction.",
          evidence: "2 400 engagements détectés",
          confidence: "Haute",
        },
      ],
      platformDiagnosis: {
        primary: {
          platform: "instagram",
          label: "Canal moteur",
          value: "Instagram",
          detail: "82% des engagements, taux 7,7%.",
          tone: "strong",
        },
        watch: {
          platform: "tiktok",
          label: "Canal à surveiller",
          value: "TikTok",
          detail: "Portée indisponible : lecture de visibilité à consolider.",
          tone: "watch",
        },
        balance: {
          platform: "instagram",
          label: "Mix de canaux",
          value: "Dominante claire",
          detail: "Instagram représente 58% de la visibilité totale.",
          tone: "balance",
        },
      },
      contentPortfolio: {
        postsAnalyzed: 3,
        dominantFormat: "Reels",
        topPlatform: "Instagram",
        averageEngagementRate: 7.7,
        qualityLabel: "Fort",
      },
      trendTrajectory: [
        {
          id: "views",
          label: "Vues",
          valueLabel: "58 k",
          changeLabel: "+8,1%",
          direction: "up",
          summary: "Traction en hausse en fin de période",
          bars: [18, 32, 45, 61, 74, 88],
        },
      ],
      platformMix: {
        leader: "instagram",
        concentrationLabel: "Mix assumé",
        items: [
          {
            platform: "instagram",
            visibilityShare: 68,
            engagementShare: 82,
            engagementRate: 7.7,
            postsShare: 60,
            role: "Moteur relationnel",
            summary: "68% de la visibilité, 82% de l'engagement.",
          },
        ],
      },
      contentDna: [
        {
          label: "Reels",
          insight: "Les reels sont votre format gagnant",
          detail: "2x plus d'engagement que les images",
          strength: 78,
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
