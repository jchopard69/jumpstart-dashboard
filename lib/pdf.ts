import type { Profile } from "@/lib/auth";

export function buildSparkline(values: number[], width = 240, height = 60) {
  if (!values.length) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1 || 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polyline points="${points}" stroke="#7c3aed" stroke-width="2" fill="none" />
  </svg>`;
}

export function buildDashboardPdfHtml(params: {
  profile: Profile;
  tenantName: string;
  rangeLabel: string;
  generatedAt: string;
  kpis: Array<{ label: string; value: string }>;
  charts: Array<{ title: string; svg: string }>;
  posts: Array<{ caption: string; date: string; impressions: number; engagements: number }>;
  collaboration: { shootDays: number; shoots: Array<{ date: string; location: string }> };
  documents: Array<{ name: string; tag: string }>
}) {
  const { tenantName, rangeLabel, generatedAt } = params;

  const kpiHtml = params.kpis
    .map(
      (kpi) => `
    <div class="kpi">
      <p class="kpi-label">${kpi.label}</p>
      <p class="kpi-value">${kpi.value}</p>
    </div>`
    )
    .join("");

  const chartHtml = params.charts
    .map(
      (chart) => `
    <div class="chart">
      <p class="chart-title">${chart.title}</p>
      ${chart.svg}
    </div>`
    )
    .join("");

  const postsHtml = params.posts
    .map(
      (post) => `
    <tr>
      <td>${post.caption}</td>
      <td>${post.date}</td>
      <td>${post.impressions}</td>
      <td>${post.engagements}</td>
    </tr>`
    )
    .join("");

  const shootsHtml = params.collaboration.shoots
    .map(
      (shoot) => `
    <li>${shoot.date} - ${shoot.location}</li>`
    )
    .join("");

  const documentsHtml = params.documents
    .map(
      (doc) => `
    <li>${doc.name} <span class="tag">${doc.tag}</span></li>`
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>JumpStart Studio | Rapport</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px; }
    header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; }
    .brand { font-size: 14px; letter-spacing: 0.3em; text-transform: uppercase; color: #64748b; }
    .title { font-size: 24px; font-weight: 700; margin: 4px 0 0; }
    .meta { text-align: right; font-size: 12px; color: #64748b; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .kpi { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
    .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #64748b; margin: 0; }
    .kpi-value { font-size: 20px; font-weight: 600; margin: 8px 0 0; }
    .charts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .chart { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
    .chart-title { font-size: 12px; color: #64748b; margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
    th, td { padding: 8px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { text-transform: uppercase; font-size: 10px; letter-spacing: 0.2em; color: #64748b; }
    section { margin-top: 24px; }
    .tag { background: #e2e8f0; border-radius: 999px; padding: 2px 8px; font-size: 10px; margin-left: 6px; }
    ul { padding-left: 18px; margin: 8px 0; }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="brand">JumpStart Studio</div>
      <div class="title">${tenantName} • Social Pulse</div>
      <div class="meta">Période : ${rangeLabel}</div>
    </div>
    <div class="meta">
      <div>Généré : ${generatedAt}</div>
    </div>
  </header>

  <section>
    <h2>Indicateurs clés</h2>
    <div class="kpi-grid">${kpiHtml}</div>
  </section>

  <section>
    <h2>Tendances</h2>
    <div class="charts">${chartHtml}</div>
  </section>

  <section>
    <h2>Top contenus</h2>
    <table>
      <thead>
        <tr>
          <th>Publication</th>
          <th>Date</th>
          <th>Impressions</th>
          <th>Engagements</th>
        </tr>
      </thead>
      <tbody>
        ${postsHtml}
      </tbody>
    </table>
  </section>

  <section>
    <h2>Collaboration</h2>
    <p>Jours de shooting restants : <strong>${params.collaboration.shootDays}</strong></p>
    <ul>${shootsHtml || "<li>Aucun shooting planifié.</li>"}</ul>
  </section>

  <section>
    <h2>Documents</h2>
    <ul>${documentsHtml || "<li>Aucun document partagé.</li>"}</ul>
  </section>
</body>
</html>`;
}
