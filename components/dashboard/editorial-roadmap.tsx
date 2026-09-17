import type { EditorialExperiment } from "@/lib/editorial-roadmap";

export function EditorialRoadmap({ experiments }: { experiments: EditorialExperiment[] }) {
  return <section id="dashboard-opportunities" className="scroll-mt-6 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="section-label">Prochaines semaines</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Le plan de test éditorial</h2></div>
      <p className="max-w-sm text-sm text-muted-foreground">Des hypothèses à valider, avec un protocole de mesure. À caler sur le calendrier de production.</p>
    </div>
    <ol className="divide-y divide-border border-y border-border">
      {experiments.map((experiment, index) => <li key={experiment.week} className="grid gap-4 py-6 md:grid-cols-[120px_1fr]">
        <div><span className="text-xs font-semibold uppercase tracking-widest text-primary">{experiment.week}</span><p aria-hidden="true" className="mt-1 text-3xl font-light text-muted-foreground/40">0{index + 1}</p></div>
        <div><h3 className="font-semibold">{experiment.title}</h3><p className="mt-2 max-w-3xl text-sm leading-relaxed">{experiment.action}</p>
          <details className="mt-3 text-sm text-muted-foreground"><summary className="cursor-pointer text-primary focus-visible:outline focus-visible:outline-2">Pourquoi et comment mesurer</summary>
            <p className="mt-3 leading-relaxed">{experiment.evidence}</p><p className="mt-2 leading-relaxed"><strong className="font-medium text-foreground">Mesure : </strong>{experiment.measure}</p>
          </details>
        </div>
      </li>)}
    </ol>
  </section>;
}
