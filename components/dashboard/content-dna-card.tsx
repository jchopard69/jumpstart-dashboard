import type { ContentDnaResult } from "@/lib/content-dna";

export function ContentDnaCard({ dna }: { dna: ContentDnaResult }) {
  return <section className="space-y-4">
    <div><h3 className="text-lg font-semibold">Signaux créatifs · Content DNA</h3><p className="mt-1 text-sm text-muted-foreground">{dna.postsAnalyzed} publications examinées. Des pistes à tester, pas des recettes garanties.</p></div>
    {dna.patterns.length ? <ul className="divide-y divide-border">{dna.patterns.map(pattern => <li key={pattern.id} className="py-4"><p className="font-medium">{pattern.label}</p><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pattern.detail}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">Pas assez de contenus comparables pour dégager une piste créative.</p>}
    <p className="text-xs leading-relaxed text-muted-foreground">Les moyennes observées varient aussi selon le réseau, le sujet, l’âge du contenu et sa diffusion. Les écarts ne démontrent pas l’effet du format, de l’horaire ou de la légende. Horaires de cette analyse : UTC.</p>
  </section>;
}
