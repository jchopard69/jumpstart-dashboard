import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { AdsData } from "@/lib/types/dashboard";

type AdsSummaryProps = {
  ads: AdsData | null;
};

export function AdsSummary({ ads }: AdsSummaryProps) {
  if (!ads?.available) {
    return null;
  }

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Campagnes Ads</h2>
          <p className="text-sm text-muted-foreground">Synthèse sur la période.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Ads</Badge>
          <Link
            href="/client/ads"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Voir tout
          </Link>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-border/60 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Spend</p>
          <p className="text-2xl font-semibold">{(ads.totals?.spend ?? 0).toFixed(2)} €</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Impressions</p>
            <p className="text-lg font-semibold">{(ads.totals?.impressions ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Portée</p>
            <p className="text-lg font-semibold">{(ads.totals?.reach ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clicks</p>
            <p className="text-lg font-semibold">{(ads.totals?.clicks ?? 0).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CTR</p>
            <p className="text-lg font-semibold">{(ads.totals?.ctr ?? 0).toFixed(2)}%</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CPC</p>
            <p className="text-lg font-semibold">{(ads.totals?.cpc ?? 0).toFixed(2)} €</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CPM</p>
            <p className="text-lg font-semibold">{(ads.totals?.cpm ?? 0).toFixed(2)} €</p>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conversions</p>
            <p className="text-lg font-semibold">{(ads.totals?.conversions ?? 0).toLocaleString()}</p>
          </div>
        </div>
        {(ads.topCampaigns?.length ?? 0) > 0 && (
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Top campagnes</p>
            <div className="mt-2 space-y-2">
              {ads.topCampaigns.slice(0, 3).map((campaign) => (
                <div key={`${campaign.platform}-${campaign.name}`} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-medium truncate">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.platform.toUpperCase()} · {campaign.impressions.toLocaleString()} impressions · {campaign.spend.toFixed(2)} €
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
