import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Admin - Réglages"
};

export default async function AdminSettingsPage() {
  const demoMode = process.env.DEMO_MODE === "true";

  return (
    <div className="space-y-8 fade-in">
      <section className="surface-panel p-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin agence</p>
            <h1 className="page-heading">Réglages</h1>
            <p className="mt-2 text-sm text-muted-foreground">Paramètres de l&apos;environnement et du runtime.</p>
          </div>
          <Badge variant="secondary">Environnement</Badge>
        </div>
      </section>

      <Card className="card-surface p-6 fade-in-up">
        <h2 className="section-title">Configuration runtime</h2>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
            <span>Mode démo</span>
            <Badge variant={demoMode ? "success" : "outline"}>{demoMode ? "Activé" : "Désactivé"}</Badge>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
            <span>Moteur PDF</span>
            <Badge variant="secondary">Chromium (puppeteer-core)</Badge>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-muted/30 px-4 py-3">
            <span>Endpoint cron</span>
            <div className="text-right text-xs text-muted-foreground">
              <div>
                <code>/api/cron/sync</code>
              </div>
              <div>
                <code>Authorization: Bearer ...</code>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export const dynamic = "force-dynamic";
