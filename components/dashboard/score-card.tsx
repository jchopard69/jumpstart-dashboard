import type { JumpStartScore } from "@/lib/scoring";

type ScoreCardProps = {
  score: JumpStartScore;
  takeaways: string[];
  executiveSummary: string;
  dataCoverage?: number | null;
  postsAnalyzed?: number;
};

export function ScoreCard({ score, takeaways, executiveSummary, dataCoverage, postsAnalyzed }: ScoreCardProps) {
  const provisional = dataCoverage == null || dataCoverage < 80;
  const circumference = 2 * Math.PI * 48;
  return <section className="overflow-hidden rounded-2xl border border-border bg-white" aria-labelledby="score-title">
    <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[220px_1fr]">
      <div className="flex items-center gap-5 lg:flex-col lg:items-start">
        <div className="relative h-28 w-28 shrink-0">
          <svg aria-hidden="true" viewBox="0 0 112 112" className="h-28 w-28 -rotate-90">
            <circle cx="56" cy="56" r="48" fill="none" stroke="#ede9f5" strokeWidth="6" />
            <circle cx="56" cy="56" r="48" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - score.global / 100)} className="text-primary" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-semibold tracking-tight tabular-nums">{score.global}</span><span className="text-xs text-muted-foreground">sur 100 · {score.grade}</span></div>
        </div>
        <div><h2 id="score-title" className="text-sm font-semibold">Score JumpStart</h2><p className="mt-1 text-xs text-muted-foreground">Indice interne · barème v1</p>
          <p className="mt-2 text-xs font-medium text-muted-foreground">{provisional ? "À interpréter avec prudence" : "À lire avec les résultats ci-contre"}</p>
        </div>
      </div>
      <div className="min-w-0">
        <p className="section-label text-primary">La période en bref</p>
        <p className="mt-3 max-w-3xl text-lg leading-relaxed text-foreground">{executiveSummary}</p>
        {takeaways.length > 0 && <ul className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-3">
          {takeaways.slice(0, 3).map(item => <li key={item} className="text-sm leading-relaxed text-muted-foreground">{item}</li>)}
        </ul>}
        <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
          {dataCoverage != null ? `${dataCoverage}% de couverture des données. ` : "Couverture non mesurée. "}
          {postsAnalyzed != null ? `${postsAnalyzed} publications examinées. ` : ""}
          La couverture mesure la présence de données, pas leur exactitude.
        </p>
      </div>
    </div>
    <details className="border-t border-border px-6 py-4 sm:px-8">
      <summary className="cursor-pointer text-sm font-medium text-primary focus-visible:outline focus-visible:outline-2">Comprendre le score et ses cinq composantes</summary>
      <div className="mt-5 grid gap-5 sm:grid-cols-5">{score.subScores.map(sub => <div key={sub.key}>
        <div className="flex justify-between gap-2 text-xs"><span>{sub.label}</span><strong>{Math.round(sub.value)}/100</strong></div>
        <div className="mt-2 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${sub.value}%` }} /></div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub.description} · poids {Math.round(sub.weight * 100)}%</p>
      </div>)}</div>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">Moyenne pondérée selon un barème interne, sans référence sectorielle : ratio d’interactions de 3% = 70/100 ; cadence de référence de 12 publications par mois ; croissance cible de 3% sur la période. Certaines données absentes reçoivent une valeur neutre, tandis qu’une portée absente peut pénaliser le score. Les audiences et portées cumulées ne sont pas dédupliquées. Comparez des périodes de même durée, avec les mêmes comptes et une couverture similaire.</p>
    </details>
  </section>;
}
