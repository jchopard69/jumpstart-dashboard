const sections = [
  ["#dashboard-kpis", "Résultats"],
  ["#dashboard-insights", "Analyse"],
  ["#dashboard-content", "Contenus"],
  ["#dashboard-opportunities", "Prochaines semaines"],
];

export function DashboardSectionNav() {
  return <nav aria-label="Sections du dashboard" className="flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4">
    {sections.map(([href, label]) => <a key={href} href={href} className="py-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{label}</a>)}
  </nav>;
}
