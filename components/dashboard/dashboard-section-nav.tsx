import { ArrowDownRight, BarChart3, FileText, LineChart, Settings2, Sparkles } from "lucide-react";

const sections = [
  {
    href: "#dashboard-opportunities",
    label: "Opportunités",
    detail: "Leviers détectés à activer",
    icon: Sparkles,
  },
  {
    href: "#dashboard-kpis",
    label: "KPIs",
    detail: "Objectifs et tendances clés",
    icon: BarChart3,
  },
  {
    href: "#dashboard-insights",
    label: "Insights",
    detail: "Analyse stratégique",
    icon: FileText,
  },
  {
    href: "#dashboard-content",
    label: "Contenus",
    detail: "Posts, horaires, formats",
    icon: LineChart,
  },
  {
    href: "#dashboard-operations",
    label: "Opérations",
    detail: "Sync, qualité, collaboration",
    icon: Settings2,
  },
];

export function DashboardSectionNav() {
  return (
    <nav className="surface-inset border-primary/10 bg-white/55 p-2 shadow-sm" aria-label="Sections du dashboard">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <a
              key={section.href}
              href={section.href}
              className="group flex min-h-[74px] items-center justify-between gap-3 rounded-xl border border-transparent bg-white/72 px-4 py-3 text-left shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition-colors hover:border-primary/20 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-foreground">{section.label}</span>
                  <span className="mt-1 block text-xs leading-snug text-muted-foreground">{section.detail}</span>
                </span>
              </span>
              <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-y-0.5 group-hover:text-primary" aria-hidden="true" />
            </a>
          );
        })}
      </div>
    </nav>
  );
}
