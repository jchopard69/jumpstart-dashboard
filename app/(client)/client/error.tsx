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
      <Card className="card-surface max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
          <svg
            className="h-8 w-8 text-rose-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Une erreur est survenue</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-foreground/60">
            Code erreur: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={() => reset()} variant="default">
            Réessayer
          </Button>
          <Button onClick={() => window.location.href = "/client/dashboard"} variant="outline">
            Retour au dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
