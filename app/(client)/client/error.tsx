"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function ClientError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Client error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center fade-in">
      <Card className="card-surface max-w-md p-10 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
          <svg
            className="h-7 w-7 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold font-display text-foreground">Une erreur est survenue</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Nous n&apos;avons pas pu charger cette page. Veuillez réessayer ou revenir au tableau de bord.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-lg bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground/60 tabular-nums">
            Réf. : {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => reset()} variant="default" size="sm">
            Réessayer
          </Button>
          <Button onClick={() => window.location.href = "/client/dashboard"} variant="outline" size="sm">
            Tableau de bord
          </Button>
        </div>
      </Card>
    </div>
  );
}
