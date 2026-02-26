"use client";

import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { PlatformConnections } from "./platform-connections";
import type { Platform } from "@/lib/types";

interface ConnectedAccount {
  id: string;
  platform: Platform;
  account_name: string;
  external_account_id: string;
  auth_status: string;
  last_sync_at: string | null;
}

interface Props {
  tenantId: string;
  isDemo?: boolean;
  accounts: ConnectedAccount[];
  deleteAction: (formData: FormData) => Promise<void>;
}

export function SocialAccountsSection({ tenantId, isDemo, accounts, deleteAction }: Props) {
  const handleDelete = async (accountId: string) => {
    if (isDemo) return;
    const formData = new FormData();
    formData.append("account_id", accountId);
    formData.append("tenant_id", tenantId);
    await deleteAction(formData);
  };

  return (
    <Card className="card-surface p-6 fade-in-up">
      <div className="mb-6">
        <h2 className="section-title">Comptes sociaux</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isDemo
            ? "Mode démo: connexions sociales verrouillées."
            : "Connectez les réseaux sociaux de ce client via OAuth sécurisé."}
        </p>
      </div>

      <Suspense fallback={<div className="animate-pulse h-48 bg-muted rounded-lg" />}>
        <PlatformConnections
          tenantId={tenantId}
          isDemo={isDemo}
          accounts={accounts}
          onDelete={handleDelete}
        />
      </Suspense>
    </Card>
  );
}
