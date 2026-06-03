"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, CalendarPlus, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";

type ContentIdea = {
  title: string;
  platform: string;
  format: string;
  angle: string;
  hook: string;
  rationale: string;
  calendarHint: string;
};

type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  model?: string;
  estimatedCostUsd?: number;
};

type Quota = {
  limit?: number;
  remaining?: number;
  retryAfterMs?: number;
};

type AiContentIdeasCardProps = {
  tenantId?: string;
  initialQuery?: string;
};

export function AiContentIdeasCard({ tenantId, initialQuery }: AiContentIdeasCardProps) {
  const searchParams = useSearchParams();
  const fallbackQuery = searchParams.toString();
  const activeQuery = useMemo(() => {
    const params = new URLSearchParams(initialQuery || fallbackQuery);
    if (tenantId) {
      params.set("tenantId", tenantId);
    }
    return params.toString();
  }, [fallbackQuery, initialQuery, tenantId]);
  const [prompt, setPrompt] = useState("Propose des idées de posts pour les 2 prochaines semaines.");
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIdeas([]);
    setUsage(null);
    setQuota(null);
    setError(null);
  }, [activeQuery]);

  const generateIdeas = () => {
    setError(null);
    const requestQuery = activeQuery;
    startTransition(async () => {
      const response = await fetch("/api/client/content-ideas", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: requestQuery,
          prompt,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setIdeas([]);
        setUsage(null);
        setQuota(payload.quota ?? null);
        setError(payload.message ?? "Impossible de générer des idées pour le moment.");
        return;
      }
      setIdeas(Array.isArray(payload.ideas) ? payload.ideas : []);
      setUsage(payload.usage ?? null);
      setQuota(payload.quota ?? null);
    });
  };

  return (
    <Card className="card-surface overflow-hidden p-0 fade-in-up">
      <div className="border-b border-border/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(237,233,254,0.74),rgba(240,253,248,0.82))] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-white/85 text-primary shadow-sm">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="section-label text-primary">Assistant IA éditorial</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal font-display">
                Idées de contenus basées sur vos statistiques
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                L'IA utilise les performances, top posts, Content DNA et signaux de la période pour proposer des angles exploitables.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usage?.totalTokens ? (
              <span className="rounded-full border border-primary/15 bg-white/70 px-3 py-1 text-xs font-semibold text-primary">
                {usage.totalTokens.toLocaleString("fr-FR")} tokens
              </span>
            ) : null}
            {typeof quota?.remaining === "number" ? (
              <span className="rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-xs font-semibold text-emerald-700">
                {quota.remaining}/{quota.limit ?? "-"} générations restantes
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="min-h-[76px] resize-none bg-white"
            aria-label="Demande pour générer des idées de contenus"
          />
          <Button onClick={generateIdeas} disabled={isPending || prompt.trim().length < 8} className="h-full min-h-[76px] gap-2">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
            Générer
          </Button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
            {error}
          </div>
        ) : null}

        {ideas.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
            {ideas.map((idea, index) => (
              <article key={`${idea.title}-${index}`} className="rounded-xl border border-border/70 bg-white/86 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    {idea.platform}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                    {idea.format}
                  </span>
                </div>
                <h3 className="mt-3 text-sm font-semibold leading-snug text-foreground">{idea.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{idea.angle}</p>
                <div className="mt-3 rounded-lg border border-primary/10 bg-primary/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Hook</p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/80">{idea.hook}</p>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{idea.rationale}</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                  {idea.calendarHint}
                </p>
              </article>
            ))}
          </div>
        ) : null}

        {usage?.model ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Modèle : {usage.model}
            {usage.inputTokens || usage.outputTokens
              ? ` - entrée ${usage.inputTokens ?? "-"} / sortie ${usage.outputTokens ?? "-"} tokens`
              : ""}
            {typeof usage.estimatedCostUsd === "number"
              ? ` - coût estimé ${usage.estimatedCostUsd.toLocaleString("fr-FR", {
                  style: "currency",
                  currency: "USD",
                  maximumFractionDigits: 4,
                })}`
              : ""}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
