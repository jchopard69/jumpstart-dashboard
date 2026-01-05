"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SecurityCheck() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const runCheck = async () => {
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/security-check", { method: "POST" });
    const data = await res.json();
    setResult(data.message);
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <Button onClick={runCheck} disabled={loading}>
        {loading ? "Contrôle en cours..." : "Lancer le contrôle d'isolation"}
      </Button>
      {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
    </div>
  );
}
