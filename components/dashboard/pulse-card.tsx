import { Card } from "@/components/ui/card";
import type { PulseResult } from "@/lib/pulse";

type PulseCardProps = {
  pulse: PulseResult;
};

export function PulseCard({ pulse }: PulseCardProps) {
  return (
    <Card className="card-surface p-6 fade-in-up overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-400" />

      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <svg className="h-4.5 w-4.5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </div>
        <div>
          <h2 className="section-title">Pulse</h2>
          <p className="text-xs text-muted-foreground">Synthese narrative de la periode.</p>
        </div>
      </div>

      {/* Headline */}
      <p className="text-sm font-medium text-foreground mb-5 leading-relaxed">
        {pulse.headline}
      </p>

      {/* Sections */}
      <div className="space-y-3">
        {pulse.sections.map((section) => (
          <div key={section.id} className="rounded-xl bg-muted/20 border border-border/30 p-4">
            <div className="flex items-start gap-3">
              <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">{section.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{section.label}</p>
                <p className="text-sm text-foreground/90 leading-relaxed">{section.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
